package httpx

import (
	"encoding/json"
	"errors"
	"net/http"
	"reflect"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New(validator.WithRequiredStructEnabled())

	v.RegisterTagNameFunc(func(f reflect.StructField) string {
		return strings.Split(f.Tag.Get("json"), ",")[0]
	})
	return v
}

const maxBodyBytes = 1 << 20

func Decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()

	if err := dec.Decode(dst); err != nil {
		if _, ok := errors.AsType[*http.MaxBytesError](err); ok {
			Error(w, http.StatusRequestEntityTooLarge, "request body too large")
			return false
		}
		Error(w, http.StatusBadRequest, "invalid JSON body")
		return false
	}
	if err := validate.Struct(dst); err != nil {
		var verrs validator.ValidationErrors
		if !errors.As(err, &verrs) {
			Error(w, http.StatusInternalServerError, "internal error")
			return false
		}
		errs := make(map[string]string, len(verrs))
		for _, fe := range verrs {
			errs[fe.Field()] = fe.Tag()
		}
		JSON(w, http.StatusUnprocessableEntity, map[string]any{"errors": errs})
		return false
	}
	return true
}
