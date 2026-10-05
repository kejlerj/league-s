package match

import (
	"time"

	"github.com/google/uuid"
)

type Status string

const (
	StatusScheduled Status = "scheduled"
	StatusLive      Status = "live"
	StatusFinished  Status = "finished"
	StatusPostponed Status = "postponed"
	StatusCancelled Status = "cancelled"
)

type Score struct {
	Home int32
	Away int32
}

type Match struct {
	id         uuid.UUID
	seasonID   uuid.UUID
	homeTeamID uuid.UUID
	awayTeamID uuid.UUID
	matchday   int32
	kickoffAt  *time.Time
	status     Status
	score      *Score
	details    Details
}

type Details struct {
	Venue         *string
	Referee       *string
	ConvocationAt *time.Time
	VideoURL      *string
}

func (d Details) isEmpty() bool {
	return d == Details{}
}

func New(seasonID, homeTeamID, awayTeamID uuid.UUID, matchday int32, kickoffAt *time.Time) (*Match, error) {
	if homeTeamID == awayTeamID {
		return nil, ErrNewSameTeams
	}
	if matchday < 1 {
		return nil, ErrNewInvalidMatchday
	}

	return &Match{
		seasonID:   seasonID,
		homeTeamID: homeTeamID,
		awayTeamID: awayTeamID,
		matchday:   matchday,
		kickoffAt:  kickoffAt,
		status:     StatusScheduled,
	}, nil
}

func (m *Match) ID() uuid.UUID         { return m.id }
func (m *Match) SeasonID() uuid.UUID   { return m.seasonID }
func (m *Match) HomeTeamID() uuid.UUID { return m.homeTeamID }
func (m *Match) AwayTeamID() uuid.UUID { return m.awayTeamID }
func (m *Match) Matchday() int32       { return m.matchday }
func (m *Match) Status() Status        { return m.status }

func (m *Match) KickoffAt() *time.Time {
	if m.kickoffAt == nil {
		return nil
	}
	return new(*m.kickoffAt)
}

func (m *Match) Score() *Score {
	if m.score == nil {
		return nil
	}
	return new(*m.score)
}

func (m *Match) Details() Details {
	return Details{
		Venue:         clone(m.details.Venue),
		Referee:       clone(m.details.Referee),
		ConvocationAt: clone(m.details.ConvocationAt),
		VideoURL:      clone(m.details.VideoURL),
	}
}

func (m *Match) UpdateDetails(d Details) {
	if d.Venue != nil {
		m.details.Venue = clone(d.Venue)
	}
	if d.Referee != nil {
		m.details.Referee = clone(d.Referee)
	}
	if d.ConvocationAt != nil {
		m.details.ConvocationAt = clone(d.ConvocationAt)
	}
	if d.VideoURL != nil {
		m.details.VideoURL = clone(d.VideoURL)
	}
}

func clone[T any](v *T) *T {
	if v == nil {
		return nil
	}
	return new(*v)
}

func (m *Match) Start() error {
	if m.status != StatusScheduled {
		return ErrStartNotScheduled
	}
	m.status = StatusLive
	m.score = &Score{}
	return nil
}

func (m *Match) SetScore(home, away int32) error {
	if m.status != StatusLive {
		return ErrSetScoreNotLive
	}
	if home < 0 || away < 0 {
		return ErrSetScoreNegative
	}
	m.score = &Score{Home: home, Away: away}
	return nil
}

func (m *Match) Finish() error {
	if m.status != StatusLive {
		return ErrFinishNotLive
	}
	m.status = StatusFinished
	return nil
}

func (m *Match) Postpone() error {
	if m.status != StatusScheduled {
		return ErrPostponeNotScheduled
	}
	m.status = StatusPostponed
	m.kickoffAt = nil
	return nil
}

func (m *Match) Reschedule(matchday int32, kickoffAt *time.Time) error {
	if m.status != StatusScheduled && m.status != StatusPostponed {
		return ErrRescheduleNotPending
	}
	if matchday < 1 {
		return ErrRescheduleInvalidMatchday
	}
	m.matchday = matchday
	m.kickoffAt = kickoffAt
	if kickoffAt != nil {
		m.status = StatusScheduled
	}
	return nil
}

func (m *Match) Cancel() error {
	if m.status != StatusScheduled && m.status != StatusPostponed {
		return ErrCancelNotPending
	}
	m.status = StatusCancelled
	return nil
}

func (m *Match) CheckDeletable() error {
	if m.status != StatusScheduled {
		return ErrDeleteNotScheduled
	}
	return nil
}

func (m *Match) Winner() (teamID uuid.UUID, draw bool, err error) {
	if m.status != StatusFinished || m.score == nil {
		return uuid.Nil, false, ErrWinnerNotFinished
	}
	switch {
	case m.score.Home > m.score.Away:
		return m.homeTeamID, false, nil
	case m.score.Away > m.score.Home:
		return m.awayTeamID, false, nil
	}
	return uuid.Nil, true, nil
}

type Season struct {
	StartOn time.Time
	EndOn   time.Time
}

func (s Season) Contains(kickoffAt time.Time) bool {
	return !kickoffAt.Before(s.StartOn) && kickoffAt.Before(s.EndOn.AddDate(0, 0, 1))
}

type Filter struct {
	Matchday *int32
	From     *time.Time
	To       *time.Time
	TeamID   *uuid.UUID
	Status   *Status
}

type NewError string

func (e NewError) Error() string { return string(e) }

const (
	ErrNewSameTeams       NewError = "a team cannot play against itself"
	ErrNewInvalidMatchday NewError = "matchday must be positive"
)

type StartError string

func (e StartError) Error() string { return string(e) }

const ErrStartNotScheduled StartError = "only a scheduled match can start"

type SetScoreError string

func (e SetScoreError) Error() string { return string(e) }

const (
	ErrSetScoreNotLive  SetScoreError = "the score can only change while the match is live"
	ErrSetScoreNegative SetScoreError = "a score cannot be negative"
)

type FinishError string

func (e FinishError) Error() string { return string(e) }

const ErrFinishNotLive FinishError = "only a live match can finish"

type PostponeError string

func (e PostponeError) Error() string { return string(e) }

const ErrPostponeNotScheduled PostponeError = "only a scheduled match can be postponed"

type RescheduleError string

func (e RescheduleError) Error() string { return string(e) }

const (
	ErrRescheduleNotPending      RescheduleError = "only a scheduled or postponed match can be rescheduled"
	ErrRescheduleInvalidMatchday RescheduleError = "matchday must be positive"
)

type CancelError string

func (e CancelError) Error() string { return string(e) }

const ErrCancelNotPending CancelError = "only a scheduled or postponed match can be cancelled"

type DeleteError string

func (e DeleteError) Error() string { return string(e) }

const ErrDeleteNotScheduled DeleteError = "only a scheduled match can be deleted"

type WinnerError string

func (e WinnerError) Error() string { return string(e) }

const ErrWinnerNotFinished WinnerError = "only a finished match has a winner"

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "match not found"

type ScheduleError string

func (e ScheduleError) Error() string { return string(e) }

const (
	ErrScheduleSeasonNotFound       ScheduleError = "season not found"
	ErrScheduleTeamNotRegistered    ScheduleError = "both teams must be registered in this season"
	ErrScheduleTeamBusy             ScheduleError = "a team already plays on this matchday"
	ErrScheduleKickoffOutsideSeason ScheduleError = "kickoff is outside the season"
)
