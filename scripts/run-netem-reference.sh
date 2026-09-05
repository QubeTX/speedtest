#!/usr/bin/env bash
# Creates only named disposable namespaces, never changes the host link or route.
set -euo pipefail
[[ "${GITHUB_ACTIONS:-}" == true ]] || { echo 'Run this harness only on a disposable GitHub runner' >&2; exit 1; }
client="sqx-client-$$"
server="sqx-server-$$"
cleanup() {
  for ns in "$client" "$server"; do
    sudo ip netns pids "$ns" 2>/dev/null | xargs -r sudo kill || true
    sudo ip netns delete "$ns" 2>/dev/null || true
  done
}
trap cleanup EXIT
sudo ip netns add "$client"
sudo ip netns add "$server"
sudo ip link add sqxc type veth peer name sqxs
sudo ip link set sqxc netns "$client"
sudo ip link set sqxs netns "$server"
sudo ip -n "$client" addr add 192.0.2.1/24 dev sqxc
sudo ip -n "$server" addr add 192.0.2.2/24 dev sqxs
for ns in "$client" "$server"; do
  sudo ip -n "$ns" link set lo up
  if [[ "$ns" == "$client" ]]; then dev=sqxc; else dev=sqxs; fi
  sudo ip -n "$ns" link set "$dev" up
  sudo ip netns exec "$ns" ethtool -K "$dev" tso off gso off gro off
  sudo ip -n "$ns" link add ifb0 type ifb
  sudo ip -n "$ns" link set ifb0 up
  sudo ip netns exec "$ns" tc qdisc add dev "$dev" handle ffff: ingress
  sudo ip netns exec "$ns" tc filter add dev "$dev" parent ffff: protocol ip u32 match u32 0 0 action mirred egress redirect dev ifb0
done
{ sudo ip netns exec "$server" sudo -u "$(id -un)" env PATH="$PATH" SPEEDQX_ISOLATED_REFERENCE=1 node scripts/netem-server.mjs; } > netem-server.log 2>&1 &
{ sudo ip netns exec "$client" sudo -u "$(id -un)" env PATH="$PATH" node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5175; } > netem-vite.log 2>&1 &
sudo ip netns exec "$client" sudo -u "$(id -un)" env PATH="$PATH" SPEEDQX_ISOLATED_REFERENCE=1 SPEEDQX_ACQUIRE="$SPEEDQX_ACQUIRE" SQX_CLIENT_NS="$client" SQX_SERVER_NS="$server" node scripts/validate-netem.mjs
