package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	SessionTTL        = 30 * 24 * time.Hour
	ResetTTL          = time.Hour
	sessionRefresh    = 24 * time.Hour
	minPasswordLength = 10
	maxPasswordBytes  = 72
)

type User struct {
	ID           uuid.UUID
	Email        string
	Name         string
	IsSuperadmin bool
}

type Credentials struct {
	User         User
	PasswordHash *string
}

type League struct {
	ID   uuid.UUID
	Name string
}

type Session struct {
	User      User
	ExpiresAt time.Time
}

func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

func HashPassword(password string) (string, error) {
	if len([]rune(password)) < minPasswordLength {
		return "", ErrPasswordTooShort
	}
	if len(password) > maxPasswordBytes {
		return "", ErrPasswordTooLong
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hash), nil
}

var decoyHash = sync.OnceValue(func() string {
	hash, err := HashPassword("a password nobody uses")
	if err != nil {
		panic(err)
	}
	return hash
})

func checkPassword(hash *string, password string) bool {
	stored := decoyHash()
	if hash != nil {
		stored = *hash
	}

	matches := bcrypt.CompareHashAndPassword([]byte(stored), []byte(password)) == nil
	return matches && hash != nil
}

func newToken() (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(raw), nil
}

func hashToken(token string) []byte {
	sum := sha256.Sum256([]byte(token))
	return sum[:]
}

type CreateUserError string

func (e CreateUserError) Error() string { return string(e) }

const ErrCreateUserEmailTaken CreateUserError = "email is already used by another account"

type PasswordError string

func (e PasswordError) Error() string { return string(e) }

const (
	ErrPasswordTooShort PasswordError = "password must be at least 10 characters long"
	ErrPasswordTooLong  PasswordError = "password must be at most 72 bytes long"
)

type ResetError string

func (e ResetError) Error() string { return string(e) }

const ErrResetInvalidLink ResetError = "reset link is invalid or has expired"

type ChangePasswordError string

func (e ChangePasswordError) Error() string { return string(e) }

const ErrChangePasswordWrongCurrent ChangePasswordError = "current password is wrong"

type EnsureSuperadminError string

func (e EnsureSuperadminError) Error() string { return string(e) }

const ErrEnsureSuperadminNotSuperadmin EnsureSuperadminError = "the account already exists and is not a superadmin"

type LoginError string

func (e LoginError) Error() string { return string(e) }

const ErrLoginInvalidCredentials LoginError = "invalid email or password"

var (
	ErrUserNotFound    = errors.New("user not found")
	ErrSessionNotFound = errors.New("session not found or expired")
)
