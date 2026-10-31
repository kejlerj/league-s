//go:build integration

package mailer

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/testcontainers/testcontainers-go"
	tclog "github.com/testcontainers/testcontainers-go/log"
	"github.com/testcontainers/testcontainers-go/wait"
)

var (
	smtpHost string
	smtpPort int
	apiURL   string
)

func TestMain(m *testing.M) {
	os.Exit(run(m))
}

func run(m *testing.M) int {
	ctx := context.Background()
	tclog.SetDefault(tclog.NewNoopLogger())

	ctr, err := testcontainers.Run(ctx, "axllent/mailpit:v1.27",
		testcontainers.WithExposedPorts("1025/tcp", "8025/tcp"),
		testcontainers.WithWaitStrategy(wait.ForHTTP("/readyz").WithPort("8025/tcp")),
	)
	if err != nil {
		log.Fatalf("start mailpit: %v", err)
	}
	defer func() { _ = ctr.Terminate(ctx) }()

	host, err := ctr.Host(ctx)
	if err != nil {
		log.Fatalf("mailpit host: %v", err)
	}
	smtp, err := ctr.MappedPort(ctx, "1025/tcp")
	if err != nil {
		log.Fatalf("mailpit SMTP port: %v", err)
	}
	api, err := ctr.MappedPort(ctx, "8025/tcp")
	if err != nil {
		log.Fatalf("mailpit API port: %v", err)
	}

	smtpHost, smtpPort = host, int(smtp.Num())
	apiURL = fmt.Sprintf("http://%s:%d", host, api.Num())
	return m.Run()
}

type received struct {
	Subject string
	Text    string
	From    struct{ Address string }
	To      []struct{ Address string }
}

func mailpit(t *testing.T, method, path string, out any) {
	t.Helper()
	req, err := http.NewRequestWithContext(t.Context(), method, apiURL+path, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer func() { _ = res.Body.Close() }()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("%s %s: status = %d", method, path, res.StatusCode)
	}
	if out != nil {
		if err := json.NewDecoder(res.Body).Decode(out); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
	}
}

func sendAndReceive(t *testing.T, msg Message) received {
	t.Helper()
	mailpit(t, http.MethodDelete, "/api/v1/messages", nil)

	sender, err := NewSMTP(SMTPConfig{Host: smtpHost, Port: smtpPort, From: "League S <no-reply@example.com>"})
	if err != nil {
		t.Fatalf("NewSMTP() error = %v", err)
	}
	if err := sender.Send(t.Context(), msg); err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	var list struct {
		Messages []struct{ ID string } `json:"messages"`
	}
	mailpit(t, http.MethodGet, "/api/v1/messages", &list)
	if len(list.Messages) != 1 {
		t.Fatalf("got %d emails, want 1", len(list.Messages))
	}

	var got received
	mailpit(t, http.MethodGet, "/api/v1/message/"+list.Messages[0].ID, &got)
	return got
}

func TestSMTP_Send(t *testing.T) {
	got := sendAndReceive(t, Message{To: "me@example.com", Subject: "Choose your password", Text: "Use the link below"})

	switch {
	case got.Subject != "Choose your password":
		t.Errorf("Subject = %q, want Choose your password", got.Subject)
	case got.From.Address != "no-reply@example.com":
		t.Errorf("From = %q, want no-reply@example.com", got.From.Address)
	case len(got.To) != 1 || got.To[0].Address != "me@example.com":
		t.Errorf("To = %v, want me@example.com", got.To)
	case strings.TrimSpace(got.Text) != "Use the link below":
		t.Errorf("Text = %q, want the text of the email", got.Text)
	}
}

func TestSMTP_Send_KeepsAccentsAndLongLines(t *testing.T) {
	text := "Bonjour Zoé,\n\nLe lien est valable 60 minutes et ne fonctionne qu'une fois : https://admin.example.com/reset-password?token=" + strings.Repeat("a", 90) + "\nÀ bientôt.\n"
	got := sendAndReceive(t, Message{To: "me@example.com", Subject: "Choisissez votre mot de passe, Zoé", Text: text})

	if got.Subject != "Choisissez votre mot de passe, Zoé" {
		t.Errorf("Subject = %q, want the accented subject", got.Subject)
	}
	if strings.ReplaceAll(got.Text, "\r\n", "\n") != text {
		t.Errorf("Text = %q, want %q", got.Text, text)
	}
}

func TestSMTP_Send_Errors(t *testing.T) {
	sender, err := NewSMTP(SMTPConfig{Host: smtpHost, Port: smtpPort, From: "no-reply@example.com"})
	if err != nil {
		t.Fatalf("NewSMTP() error = %v", err)
	}

	if err := sender.Send(t.Context(), Message{To: "not an address", Subject: "Hello", Text: "Hello"}); err == nil {
		t.Error("Send() error = nil, want an error for an invalid recipient")
	}
}

func TestSMTP_Send_RefusesCredentialsWithoutTLS(t *testing.T) {
	sender, err := NewSMTP(SMTPConfig{Host: smtpHost, Port: smtpPort, Username: "user", Password: "secret", From: "no-reply@example.com"})
	if err != nil {
		t.Fatalf("NewSMTP() error = %v", err)
	}

	if err := sender.Send(t.Context(), Message{To: "me@example.com", Subject: "Hello", Text: "Hello"}); !errors.Is(err, ErrNoTLS) {
		t.Errorf("Send() error = %v, want %v", err, ErrNoTLS)
	}
}

func TestDisabled_Send(t *testing.T) {
	if err := (Disabled{}).Send(t.Context(), Message{}); !errors.Is(err, ErrDisabled) {
		t.Errorf("Send() error = %v, want %v", err, ErrDisabled)
	}
}
