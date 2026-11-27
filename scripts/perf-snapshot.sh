#!/usr/bin/env bash
# Captures CPU %, Pss, Rss and thread counts for auralune-desktop and its WebKitGTK children.
# Usage: scripts/perf-snapshot.sh [seconds=30] [label]
set -euo pipefail

SECONDS_WINDOW="${1:-30}"
LABEL="${2:-snapshot}"

if ! [[ "$SECONDS_WINDOW" =~ ^[0-9]+$ ]] || [[ "$SECONDS_WINDOW" -lt 1 ]]; then
  echo "Usage: $0 [seconds>=1] [label]" >&2
  exit 1
fi

CLK_TCK="$(getconf CLK_TCK)"

read_stat_fields() {
  local pid="$1"
  [[ -r "/proc/${pid}/stat" ]] || return 1
  awk '{
    sub(/^.*\) /, "");
    printf "%s %s\n", $2, ($12 + $13)
  }' "/proc/${pid}/stat" 2>/dev/null
}

is_descendant_of_any() {
  local pid="$1"
  shift
  local roots=" $* "
  local cur="$pid"
  local hops=0
  while [[ -n "$cur" && "$cur" -gt 1 && "$hops" -lt 16 ]]; do
    if [[ "$roots" == *" ${cur} "* ]]; then
      return 0
    fi
    local info
    info="$(read_stat_fields "$cur")" || return 1
    cur="${info%% *}"
    hops=$((hops + 1))
  done
  return 1
}

read_proc_name() {
  local pid="$1"
  if [[ -L "/proc/${pid}/exe" ]]; then
    local exe
    exe="$(readlink -f "/proc/${pid}/exe" 2>/dev/null || true)"
    if [[ -n "$exe" ]]; then
      basename "$exe"
      return 0
    fi
  fi
  if [[ -r "/proc/${pid}/comm" ]]; then
    tr -d '\n' < "/proc/${pid}/comm"
  else
    echo "unknown"
  fi
}

collect_pids() {
  local -a main_pids=()
  local pid
  while IFS= read -r pid; do
    [[ -n "$pid" && "$pid" != "$$" && "$pid" != "$BASHPID" ]] || continue
    local name
    name="$(read_proc_name "$pid")"
    if [[ "$name" == "auralune-desktop" || "$name" == "auralune" || "$name" == "auralune-deskto" ]]; then
      main_pids+=("$pid")
    fi
  done < <(pgrep -f 'auralune-desktop' || true)

  if [[ "${#main_pids[@]}" -eq 0 ]]; then
    return 1
  fi

  local -a all_pids=("${main_pids[@]}")
  while IFS= read -r pid; do
    [[ -n "$pid" && "$pid" != "$$" && "$pid" != "$BASHPID" ]] || continue
    local comm
    comm="$(read_proc_name "$pid")"
    if [[ "$comm" == "WebKitWebProcess" || "$comm" == "WebKitNetworkProcess" ]]; then
      if is_descendant_of_any "$pid" "${main_pids[@]}"; then
        all_pids+=("$pid")
      fi
    fi
  done < <(pgrep -f 'WebKit(Web|Network)Process' || true)

  printf '%s\n' "${all_pids[@]}"
}

mapfile -t PIDS < <(collect_pids || true)
if [[ "${#PIDS[@]}" -eq 0 ]]; then
  echo "No running auralune-desktop process found." >&2
  exit 1
fi

declare -A T0_TICKS=()
declare -A PROC_NAMES=()
for pid in "${PIDS[@]}"; do
  if info="$(read_stat_fields "$pid")"; then
    T0_TICKS["$pid"]="${info#* }"
    PROC_NAMES["$pid"]="$(read_proc_name "$pid")"
  fi
done

T0_NS="$(date +%s%N)"
sleep "$SECONDS_WINDOW"
T1_NS="$(date +%s%N)"

ELAPSED_S="$(awk -v t0="$T0_NS" -v t1="$T1_NS" 'BEGIN { d = (t1 - t0) / 1000000000.0; if (d <= 0) d = 1; printf "%.6f", d }')"

echo "| Label | PID | Process | CPU % | Pss (MB) | Rss (MB) | Threads |"
echo "| --- | ---: | --- | ---: | ---: | ---: | ---: |"

for pid in "${PIDS[@]}"; do
  [[ -n "${T0_TICKS[$pid]:-}" ]] || continue
  info1="$(read_stat_fields "$pid" || true)"
  if [[ -z "$info1" ]]; then
    echo "| ${LABEL} | ${pid} | ${PROC_NAMES[$pid]} | exited | - | - | - |"
    continue
  fi
  t1="${info1#* }"
  t0="${T0_TICKS[$pid]}"
  cpu_pct="$(awk -v d="$((t1 - t0))" -v hz="$CLK_TCK" -v s="$ELAPSED_S" 'BEGIN { printf "%.1f", (100.0 * d) / (hz * s) }')"

  pss_mb="N/A"
  rss_mb="N/A"
  if [[ -r "/proc/${pid}/smaps_rollup" ]]; then
    read -r pss_kb rss_kb < <(awk '
      /^Pss:/ { pss = $2 }
      /^Rss:/ { rss = $2 }
      END { printf "%s %s\n", (pss != "" ? pss : -1), (rss != "" ? rss : -1) }
    ' "/proc/${pid}/smaps_rollup")
    if [[ "$pss_kb" -ge 0 ]]; then
      pss_mb="$(awk -v kb="$pss_kb" 'BEGIN { printf "%.1f", kb / 1024.0 }')"
    fi
    if [[ "$rss_kb" -ge 0 ]]; then
      rss_mb="$(awk -v kb="$rss_kb" 'BEGIN { printf "%.1f", kb / 1024.0 }')"
    fi
  fi

  threads="N/A"
  if [[ -r "/proc/${pid}/status" ]]; then
    threads="$(awk '/^Threads:/ { print $2; exit }' "/proc/${pid}/status")"
  fi

  echo "| ${LABEL} | ${pid} | ${PROC_NAMES[$pid]} | ${cpu_pct} | ${pss_mb} | ${rss_mb} | ${threads} |"
done
