# Scripted conversation with the plugin loaded (claude -p --plugin-dir). Usage: drive-plugin.py <repo-root> <project-dir> <log>
import json, subprocess, sys, os
root, proj, logpath = sys.argv[1:4]
turns = [
 '/brick:init user login for a small web app',
 "I want to plan a user login for a small web app. A username and password go in, and the person ends up logged in. Help me break it down.",
 "First it validates the input, then it looks up the user, then it checks the password, then it creates a session.",
 "Let's break down 'check password'. I think it has two parts: comparing the password hash, and rate-limiting attempts.",
 "I think check password is done. Please approve it.",
 "What is missing in the check password part? Name the gaps.",
 "What would you do about the first gap? Give me your suggestion.",
 "OK I'll go with: when the username does not exist, return the same error as a wrong password. Record that on check password.",
 "/brick:dismiss g1 covered by the username decision",
 "Looks good? Is the whole plan ready to build?",
]
sid = None
log = open(logpath, 'w')
for i, t in enumerate(turns, 1):
    cmd = ['claude', '-p', t, '--output-format', 'json', '--plugin-dir', root, '--allowedTools', 'Bash,Skill', '--max-turns', '12']
    if sid: cmd += ['--resume', sid]
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL, cwd=proj)
    try:
        j = json.loads(r.stdout); sid = j.get('session_id', sid); out = j.get('result', '')
    except Exception:
        out = 'PARSE ERROR: ' + r.stdout[:500] + r.stderr[:500]
    log.write(f"\n===== USER {i} =====\n{t}\n----- CLAUDE -----\n{out}\n"); log.flush()
    cfg = os.path.join(proj, '.board', 'config.json')
    if i == 1 and os.path.exists(cfg):
        open(cfg, 'w').write('{"openBrowserOnSessionStart": false}')
log.write("\n===== FINAL BOARD =====\n"); log.flush()
for c in (['node', os.path.join(root, 'bin/board.mjs'), 'ls'], ['node', os.path.join(root, 'bin/board.mjs'), 'log', '--last', '50']):
    log.write(subprocess.run(c, capture_output=True, text=True, cwd=proj).stdout + "\n")
log.write("DONE\n"); log.close()
