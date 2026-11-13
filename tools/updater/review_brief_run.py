"""Running a claim's command (once or several times) and judging a number with a tolerance.

Used by review_brief.py. A noisy test does not give the same number twice, so a claim can say:

    run: node enemy_chase.js | runs: 3 | number: "avgStuck":([\\d.]+) | want: ~ 0.5 +- 0.1

The command runs 3 times, the number is read from each run, and the MEDIAN is judged. Every run must exit 0, and an
`expect:` pattern must match in every run: a test that fails now and then is itself a finding, so it is never averaged away.

`want:` is one of   <= N   >= N   < N   > N   ~ N   = N   and may end with  +- T  (a tolerance).
With <= or >= the tolerance widens what passes (<= 0.5 +- 0.1 passes 0.6); with ~ or = the value must be within T of N.
"""
import os
import re
import shlex
import shutil
import statistics
import subprocess

ALLOWED = {'node', 'python', 'python3', 'npm', 'npx', 'pytest'}
MAX_RUNS = 10
WANT_RE = re.compile(r'^(<=|>=|<|>|=|~)\s*(-?\d+(?:\.\d+)?)(?:\s*(?:\+-|\+/-|±)\s*(\d+(?:\.\d+)?))?$')


def run_once(command, repo, allow, timeout):
    """-> (CompletedProcess or None, output text or the reason it was refused)."""
    if re.search(r'[;&|<>`$\n]', command):
        return None, 'refused: the command has shell characters; write one plain command'
    words = shlex.split(command)
    if not words or os.path.basename(words[0]) not in allow:
        return None, 'refused: %s is not an allowed command (allowed: %s)' % (words[0] if words else '?', ', '.join(sorted(allow)))
    exe = shutil.which(words[0])
    if not exe:
        return None, 'refused: %s is not installed here' % words[0]
    try:
        done = subprocess.run([exe] + words[1:], cwd=repo, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return None, 'timed out after %d s' % timeout
    return done, ((done.stdout or '') + (done.stderr or ''))[-4000:]


def run_many(command, repo, allow, timeout, n, cache):
    """The first n runs of a command. `cache` (command, folder -> runs so far) lets claims share runs; a refusal stops early."""
    key = (command, repo)
    runs = cache.setdefault(key, [])
    while len(runs) < n and not (runs and runs[-1][0] is None):
        runs.append(run_once(command, repo, allow, timeout))
    return runs[:n]


def parse_want(text):
    m = WANT_RE.match(text.strip())
    if not m:
        raise ValueError('want: must look like  <= 0.5  or  ~ 73 +- 2  (got "%s")' % text)
    return m.group(1), float(m.group(2)), float(m.group(3) or 0)


def meets(want, x):
    op, value, tol = want
    eps = 1e-9
    if op == '<=':
        return x <= value + tol + eps
    if op == '>=':
        return x >= value - tol - eps
    if op == '<':
        return x < value + tol - eps
    if op == '>':
        return x > value - tol + eps
    return abs(x - value) <= tol + eps                       # ~ and =


def read_numbers(pattern, outputs):
    """The first captured number in each output -> ([floats], index of the first run with none or None)."""
    values = []
    for i, out in enumerate(outputs):
        m = re.search(pattern, out)
        try:
            values.append(float(m.group(1)))
        except (AttributeError, ValueError, IndexError):
            return values, i
    return values, None


def shown(x):
    return ('%g' % x)


def judge_number(pattern, want_text, outputs):
    """-> (ok, evidence line). The median of the numbers must meet `want`."""
    want = parse_want(want_text)
    values, missing = read_numbers(pattern, outputs)
    if missing is not None:
        return False, 'number %s: no number found in run %d of %d' % (pattern, missing + 1, len(outputs))
    median = statistics.median(values)
    spread = ', '.join(shown(v) for v in values)
    ok = meets(want, median)
    return ok, 'number %s: %s (median %s); want %s: %s' % (pattern, spread, shown(median), want_text.strip(), 'met' if ok else 'NOT met')
