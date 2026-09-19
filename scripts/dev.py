import subprocess
import sys
import os

def run_dev():
    print("=" * 60)
    print("Silent Meeting Assistant — Development Environment")
    print("=" * 60)
    print("Mode: MOCK (Local offline development)")
    print("Starting backend server at http://127.0.0.1:8000...")
    print("WebSocket stream available at ws://127.0.0.1:8000/ws/events")
    print("To launch frontend: cd frontend && npm run dev")
    print("=" * 60)
    
    env = os.environ.copy()
    env["DEV_MODE"] = "mock"
    proc = subprocess.Popen([sys.executable, "-m", "backend.main"], env=env)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        print("\nShutdown complete.")

if __name__ == "__main__":
    run_dev()
