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
	Messages []struct {
		Subject string
		Snippet string
		From    struct{ Address string }
		To      []struct{ Address string }
	} `json:"messages"`
}

func TestSMTP_Send(t *testing.T) {
	sender, err := NewSMTP(SMTPConfig{Host: smtpHost, Port: smtpPort, From: "League S <no-reply@example.com>"})
	if err != nil {
		t.Fatalf("NewSMTP() error = %v", err)
	}

	err = sender.Send(t.Context(), Message{To: "me@example.com", Subject: "Choose your password", Text: "Use the link below"})
	if err != nil {
		t.Fatalf("Send() error = %v", err)
	}

	req, err := http.NewRequestWithContext(t.Context(), http.MethodGet, apiURL+"/api/v1/messages", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("list received emails: %v", err)
	}
	defer func() { _ = res.Body.Close() }()

	var got received
	if err := json.NewDecoder(res.Body).Decode(&got); err != nil {
		t.Fatalf("decode received emails: %v", err)
	}
	if len(got.Messages) != 1 {
		t.Fatalf("got %d emails, want 1", len(got.Messages))
	}

	msg := got.Messages[0]
	switch {
	case msg.Subject != "Choose your password":
		t.Errorf("Subject = %q, want Choose your password", msg.Subject)
	case msg.From.Address != "no-reply@example.com":
		t.Errorf("From = %q, want no-reply@example.com", msg.From.Address)
	case len(msg.To) != 1 || msg.To[0].Address != "me@example.com":
		t.Errorf("To = %v, want me@example.com", msg.To)
	case msg.Snippet != "Use the link below":
		t.Errorf("Snippet = %q, want the text of the email", msg.Snippet)
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

func TestDisabled_Send(t *testing.T) {
	if err := (Disabled{}).Send(t.Context(), Message{}); !errors.Is(err, ErrDisabled) {
		t.Errorf("Send() error = %v, want %v", err, ErrDisabled)
	}
}
