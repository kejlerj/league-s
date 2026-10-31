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

	v.RegisterTagNameFunc(jsonFieldName)
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
		dstType := reflect.TypeOf(dst).Elem()
		errs := make(map[string]string, len(verrs))
		for _, fe := range verrs {
			errs[fe.Field()] = message(fe, dstType)
		}
		JSON(w, http.StatusUnprocessableEntity, map[string]any{"errors": errs})
		return false
	}
	return true
}

func message(fe validator.FieldError, dstType reflect.Type) string {
	switch fe.Tag() {
	case "required":
		return "obligatoire"
	case "min":
		if fe.Kind() == reflect.String {
			return fe.Param() + " caractères minimum"
		}
		return "doit être au moins " + fe.Param()
	case "max":
		if fe.Kind() == reflect.String {
			return fe.Param() + " caractères maximum"
		}
		return "doit être au plus " + fe.Param()
	case "http_url":
		return "doit être une URL http ou https"
	case "email":
		return "doit être une adresse e-mail valide"
	case "uuid":
		return "doit être un identifiant valide"
	case "datetime":
		return "doit être une date au format AAAA-MM-JJ"
	case "gtfield":
		return "doit être après " + jsonName(dstType, fe.Param())
	case "nefield":
		return "doit être différent de " + jsonName(dstType, fe.Param())
	case "oneof":
		return "doit valoir " + joinAlternatives(strings.Fields(fe.Param()))
	default:
		return "invalide"
	}
}

func jsonName(structType reflect.Type, fieldName string) string {
	if structType.Kind() != reflect.Struct {
		return fieldName
	}
	f, ok := structType.FieldByName(fieldName)
	if !ok {
		return fieldName
	}
	return jsonFieldName(f)
}

func jsonFieldName(f reflect.StructField) string {
	return strings.Split(f.Tag.Get("json"), ",")[0]
}

func joinAlternatives(values []string) string {
	if len(values) == 1 {
		return values[0]
	}
	return strings.Join(values[:len(values)-1], ", ") + " ou " + values[len(values)-1]
}
