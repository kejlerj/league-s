package httpx

import "time"

func MustDate(v string) time.Time {
	d, err := time.Parse(time.DateOnly, v)
	if err != nil {
		panic("httpx: date not validated before parsing: " + v)
	}
	return d
}

func FormatDate(d time.Time) string {
	return d.Format(time.DateOnly)
}

func FormatOptionalDate(d *time.Time) *string {
	if d == nil {
		return nil
	}
	return new(FormatDate(*d))
}
