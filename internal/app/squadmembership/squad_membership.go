package squadmembership

import (
	"time"

	"github.com/google/uuid"

	"league-s/internal/app/player"
)

type Membership struct {
	ID       uuid.UUID
	LeagueID uuid.UUID
	SeasonID uuid.UUID
	TeamID   uuid.UUID
	PlayerID uuid.UUID
	Number   *int32
	JoinedOn time.Time
	LeftOn   *time.Time
}

type Member struct {
	player.Player
	MembershipID uuid.UUID
	Number       *int32
	JoinedOn     time.Time
	LeftOn       *time.Time
	Goals        int32
	Assists      int32
}

type Stint struct {
	MembershipID uuid.UUID
	SeasonID     uuid.UUID
	SeasonName   string
	TeamID       uuid.UUID
	TeamName     string
	TeamLogo     *string
	Number       *int32
	JoinedOn     time.Time
	LeftOn       *time.Time
}

type SquadRules struct {
	SeasonStartOn time.Time
	SeasonEndOn   time.Time
	MaxSize       *int32
}

func (r SquadRules) inSeason(d time.Time) bool {
	return !d.Before(r.SeasonStartOn) && !d.After(r.SeasonEndOn)
}

func (r SquadRules) CheckJoin(joinedOn time.Time, activeMembers int64) error {
	if !r.inSeason(joinedOn) {
		return ErrJoinOutsideSeason
	}
	if r.MaxSize != nil && activeMembers >= int64(*r.MaxSize) {
		return ErrJoinSquadFull
	}
	return nil
}

func (r SquadRules) CheckLeave(leftOn time.Time) error {
	if !r.inSeason(leftOn) {
		return ErrLeaveOutsideSeason
	}
	return nil
}

type Transfer struct {
	LeagueID   uuid.UUID
	SeasonID   uuid.UUID
	PlayerID   uuid.UUID
	FromTeamID uuid.UUID
	ToTeamID   uuid.UUID
	Number     *int32
	On         time.Time
}

func (t Transfer) JoinedOn() time.Time {
	return t.On.AddDate(0, 0, 1)
}

type JoinError string

func (e JoinError) Error() string { return string(e) }

const (
	ErrJoinPlayerNotFound      JoinError = "player not found"
	ErrJoinTeamNotRegistered   JoinError = "team is not registered in this season"
	ErrJoinPlayerAlreadyActive JoinError = "player is already in a squad this season"
	ErrJoinNumberTaken         JoinError = "number is already taken in this squad"
	ErrJoinOutsideSeason       JoinError = "joining date is outside the season"
	ErrJoinSquadFull           JoinError = "squad is full"
	ErrJoinOverlap             JoinError = "player is already in a squad on these dates"
)

type LeaveError string

func (e LeaveError) Error() string { return string(e) }

const (
	ErrLeaveNotFound          LeaveError = "membership not found"
	ErrLeaveNotActive         LeaveError = "player is not an active member of this squad"
	ErrLeaveBeforeJoining     LeaveError = "leaving date is before the joining date"
	ErrLeaveTeamNotRegistered LeaveError = "team is not registered in this season"
	ErrLeaveOutsideSeason     LeaveError = "leaving date is outside the season"
)

type ActiveError string

func (e ActiveError) Error() string { return string(e) }

const ErrActiveNotFound ActiveError = "player is not in any squad this season"

type LockError string

func (e LockError) Error() string { return string(e) }

const ErrLockTeamNotRegistered LockError = "team is not registered in this season"

type RulesError string

func (e RulesError) Error() string { return string(e) }

const ErrRulesTeamNotRegistered RulesError = "team is not registered in this season"

type GetError string

func (e GetError) Error() string { return string(e) }

const ErrGetNotFound GetError = "membership not found"

type ChangeNumberError string

func (e ChangeNumberError) Error() string { return string(e) }

const (
	ErrChangeNumberNotActive ChangeNumberError = "membership not found or no longer active"
	ErrChangeNumberTaken     ChangeNumberError = "number is already taken in this squad"
)

type CareerError string

func (e CareerError) Error() string { return string(e) }

const ErrCareerPlayerNotFound CareerError = "player not found"
