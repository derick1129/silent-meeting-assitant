import subprocess
import sys
import os

def run_dev():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    sys.path.insert(0, project_root)
    
    from backend.config import get_settings
    settings = get_settings()

    print("=" * 65)
    print(" 🚀 SILENT MEETING ASSISTANT — BACKEND SERVER")
    print("=" * 65)
    print(f"• Active Mode       : {settings.dev_mode}")
    print(f"• Server URL        : http://{settings.host}:{settings.port}")
    print(f"• WebSocket Stream  : ws://{settings.host}:{settings.port}/ws/events")
    print(f"• Gemini Active     : {bool(settings.gemini_api_key)}")
    print(f"• Deepgram Active   : {bool(settings.deepgram_api_key)}")
    print(f"• VSR Pipeline      : {'Enabled (' + settings.vsr_model_id + ' on ' + settings.vsr_device + ')' if settings.vsr_enabled else 'Disabled'}")
    print("=" * 65)
    print("👉 Frontend: in another terminal, run: cd frontend && npm run dev")
    print("=" * 65)
    
    env = os.environ.copy()
    env["PYTHONPATH"] = project_root
    proc = subprocess.Popen([sys.executable, "-m", "backend.main"], env=env, cwd=project_root)
    try:
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        print("\nShutdown complete.")

if __name__ == "__main__":
    run_dev()
