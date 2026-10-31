package auth

import (
	"context"
	"strings"
	"testing"
	"time"

	"league-s/internal/mailer"
)

type fakeMailer struct {
	sent chan mailer.Message
}

func (m fakeMailer) Send(_ context.Context, msg mailer.Message) error {
	m.sent <- msg
	return nil
}

func TestEmailNotifier_PasswordReset(t *testing.T) {
	sent := make(chan mailer.Message, 1)
	notifier := EmailNotifier{Mailer: fakeMailer{sent: sent}, AdminURL: "https://admin.example.com"}

	ctx, cancel := context.WithCancel(t.Context())
	notifier.PasswordReset(ctx, User{Email: "me@example.com", Name: "Jeremy"}, "the-token")
	cancel()

	select {
	case msg := <-sent:
		if msg.To != "me@example.com" {
			t.Errorf("To = %q, want me@example.com", msg.To)
		}
		if !strings.Contains(msg.Text, "https://admin.example.com/reset-password?token=the-token") {
			t.Errorf("Text = %q, want it to contain the reset link", msg.Text)
		}
		if !strings.Contains(msg.Text, "60 minutes") {
			t.Errorf("Text = %q, want it to say how long the link is valid", msg.Text)
		}
	case <-time.After(time.Second):
		t.Fatal("no email sent, want one even after the request is over")
	}
}
