package mailer

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"errors"
	"fmt"
	"mime"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

type Message struct {
	To      string
	Subject string
	Text    string
}

var (
	ErrDisabled = errors.New("email sending is not configured")
	ErrNoTLS    = errors.New("the SMTP server does not offer STARTTLS, credentials are not sent in clear text")
)

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
	host     string
	addr     string
	username string
	password string
	from     *mail.Address
}

func NewSMTP(cfg SMTPConfig) (*SMTP, error) {
	from, err := mail.ParseAddress(cfg.From)
	if err != nil {
		return nil, fmt.Errorf("parse sender %q: %w", cfg.From, err)
	}

	return &SMTP{
		host:     cfg.Host,
		addr:     net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		username: cfg.Username,
		password: cfg.Password,
		from:     from,
	}, nil
}

func (s *SMTP) Send(ctx context.Context, msg Message) error {
	to, err := mail.ParseAddress(msg.To)
	if err != nil {
		return fmt.Errorf("parse recipient: %w", err)
	}

	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "tcp", s.addr)
	if err != nil {
		return fmt.Errorf("connect to %s: %w", s.addr, err)
	}
	defer func() { _ = conn.Close() }()
	stop := context.AfterFunc(ctx, func() { _ = conn.SetDeadline(time.Now()) })
	defer stop()

	client, err := smtp.NewClient(conn, s.host)
	if err != nil {
		return fmt.Errorf("start SMTP session: %w", err)
	}
	defer func() { _ = client.Close() }()

	if err := s.secure(client); err != nil {
		return err
	}
	if err := client.Mail(s.from.Address); err != nil {
		return fmt.Errorf("set sender: %w", err)
	}
	if err := client.Rcpt(to.Address); err != nil {
		return fmt.Errorf("set recipient: %w", err)
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("start email data: %w", err)
	}
	if _, err := w.Write(s.compose(to, msg)); err != nil {
		return fmt.Errorf("write email: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("send email: %w", err)
	}

	return client.Quit()
}

func (s *SMTP) secure(client *smtp.Client) error {
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: s.host, MinVersion: tls.VersionTLS12}); err != nil {
			return fmt.Errorf("start TLS: %w", err)
		}
	} else if s.username != "" {
		return ErrNoTLS
	}

	if s.username == "" {
		return nil
	}
	if err := client.Auth(smtp.PlainAuth("", s.username, s.password, s.host)); err != nil {
		return fmt.Errorf("authenticate: %w", err)
	}
	return nil
}

func (s *SMTP) compose(to *mail.Address, msg Message) []byte {
	var b bytes.Buffer
	_, domain, _ := strings.Cut(s.from.Address, "@")

	fmt.Fprintf(&b, "From: %s\r\n", s.from)
	fmt.Fprintf(&b, "To: %s\r\n", to)
	fmt.Fprintf(&b, "Subject: %s\r\n", mime.QEncoding.Encode("utf-8", msg.Subject))
	fmt.Fprintf(&b, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	fmt.Fprintf(&b, "Message-ID: <%s@%s>\r\n", rand.Text(), domain)
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString("Content-Type: text/plain; charset=utf-8\r\n")
	b.WriteString("Content-Transfer-Encoding: quoted-printable\r\n\r\n")

	body := quotedprintable.NewWriter(&b)
	_, _ = body.Write([]byte(msg.Text))
	_ = body.Close()

	return b.Bytes()
}
