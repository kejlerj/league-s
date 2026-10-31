package mailer

import (
	"context"
	"errors"
	"fmt"

	"github.com/wneessen/go-mail"
)

type Message struct {
	To      string
	Subject string
	Text    string
}

var ErrDisabled = errors.New("email sending is not configured")

type Disabled struct{}

func (Disabled) Send(context.Context, Message) error {
	return ErrDisabled
}

type SMTPConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
}

type SMTP struct {
	client *mail.Client
	from   string
}

func NewSMTP(cfg SMTPConfig) (*SMTP, error) {
	opts := []mail.Option{mail.WithPort(cfg.Port)}
	if cfg.Username == "" {
		opts = append(opts, mail.WithTLSPolicy(mail.TLSOpportunistic))
	} else {
		opts = append(opts,
			mail.WithTLSPolicy(mail.TLSMandatory),
			mail.WithSMTPAuth(mail.SMTPAuthAutoDiscover),
			mail.WithUsername(cfg.Username),
			mail.WithPassword(cfg.Password),
		)
	}

	client, err := mail.NewClient(cfg.Host, opts...)
	if err != nil {
		return nil, fmt.Errorf("create SMTP client: %w", err)
	}

	return &SMTP{client: client, from: cfg.From}, nil
}

func (s *SMTP) Send(ctx context.Context, msg Message) error {
	m := mail.NewMsg()
	if err := m.From(s.from); err != nil {
		return fmt.Errorf("set sender %q: %w", s.from, err)
	}
	if err := m.To(msg.To); err != nil {
		return fmt.Errorf("set recipient: %w", err)
	}
	m.Subject(msg.Subject)
	m.SetBodyString(mail.TypeTextPlain, msg.Text)

	if err := s.client.DialAndSendWithContext(ctx, m); err != nil {
		return fmt.Errorf("send email: %w", err)
	}
	return nil
}
