package auth

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"league-s/internal/mailer"
)

const sendTimeout = 15 * time.Second

type Mailer interface {
	Send(ctx context.Context, msg mailer.Message) error
}

type EmailNotifier struct {
	Mailer   Mailer
	AdminURL string
}

func (n EmailNotifier) PasswordReset(ctx context.Context, user User, token string) {
	msg := n.passwordResetMessage(user, token)
	ctx = context.WithoutCancel(ctx)

	go func() {
		ctx, cancel := context.WithTimeout(ctx, sendTimeout)
		defer cancel()

		if err := n.Mailer.Send(ctx, msg); err != nil {
			slog.ErrorContext(ctx, "send password reset email", "err", err, "user_id", user.ID)
		}
	}()
}

func (n EmailNotifier) passwordResetMessage(user User, token string) mailer.Message {
	return mailer.Message{
		To:      user.Email,
		Subject: "Choisissez votre mot de passe League S",
		Text: fmt.Sprintf(`Bonjour %s,

Utilisez le lien ci-dessous pour choisir votre mot de passe :

%s/reset-password?token=%s

Le lien est valable %d minutes et ne fonctionne qu'une fois.
Si vous ne l'avez pas demandé, vous pouvez ignorer cet e-mail.
`, user.Name, n.AdminURL, token, int(ResetTTL.Minutes())),
	}
}
