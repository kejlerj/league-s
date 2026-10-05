//go:build integration

package standing

import (
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"league-s/internal/testdb"
)

var testPool *pgxpool.Pool

func TestMain(m *testing.M) {
	os.Exit(testdb.Run(m, &testPool))
}
