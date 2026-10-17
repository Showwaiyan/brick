# Drives a scripted multi-turn conversation with claude -p, playing the user.
import json, subprocess, sys, os
turns = [
 "I want to plan a user login for a small web app. A username and password go in, and the person ends up logged in. Help me break it down.",
 "First it validates the input, then it looks up the user, then it checks the password, then it creates a session.",
 "Let's break down 'check password'. I think it has two parts: comparing the password hash, and rate-limiting attempts.",
 "I think check password is done. Please approve it.",
 "What is missing in the check password part? Name the gaps.",
 "What would you do about the first gap? Give me your suggestion.",
 "OK I'll go with: when the username does not exist, return the same error as a wrong password. Record that on check password.",
 "Looks good? Is the whole plan ready to build?",
]
sid = None
log = open(sys.argv[1], 'w')
for i, t in enumerate(turns, 1):
    cmd = ['claude', '-p', t, '--output-format', 'json', '--allowedTools', 'Bash,Skill', '--max-turns', '12']
    if sid: cmd += ['--resume', sid]
    r = subprocess.run(cmd, capture_output=True, text=True, stdin=subprocess.DEVNULL)
    try:
        j = json.loads(r.stdout); sid = j.get('session_id', sid); out = j.get('result', '')
    except Exception:
        out = 'PARSE ERROR: ' + r.stdout[:500] + r.stderr[:500]
    log.write(f"\n===== USER {i} =====\n{t}\n----- CLAUDE -----\n{out}\n"); log.flush()
log.write("\n===== FINAL BOARD =====\n"); log.flush()
for c in (['board','ls'], ['board','log','--last','40']):
    log.write(subprocess.run(c, capture_output=True, text=True).stdout + "\n")
log.write("DONE\n"); log.close()
