#!/usr/bin/env python3
"""
CelestialSim Web Server
======================

A simple HTTP server that serves the CelestialSim web application
and automatically opens it in the default web browser.

Features:
- Serves static files (HTML, CSS, JS, images)
- Auto-opens browser on startup
- Cross-platform compatibility
- Professional logging
- Graceful shutdown handling
"""

import http.server
import socketserver
import webbrowser
import os
import sys
import signal
import time
import threading
from pathlib import Path

class NBodyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP request handler with enhanced features"""
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).parent / "web"), **kwargs)
    
    def log_message(self, format, *args):
        """Override to provide cleaner logging"""
        print(f"[{time.strftime('%H:%M:%S')}] {format % args}")
    
    def end_headers(self):
        """Add security headers and CORS for local development"""
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()
    
    def guess_type(self, path):
        """Enhanced MIME type detection"""
        result = super().guess_type(path)
        if isinstance(result, tuple) and len(result) >= 2:
            mimetype, encoding = result[0], result[1]
        else:
            mimetype, encoding = result, None
        
        # Handle additional file types
        if path.endswith('.js'):
            return 'application/javascript'
        elif path.endswith('.json'):
            return 'application/json'
        elif path.endswith('.woff2'):
            return 'font/woff2'
        elif path.endswith('.woff'):
            return 'font/woff'
        
        return mimetype

class NBodyServer:
    """Main server class for CelestialSim"""
    
    def __init__(self, port=8000, host='localhost'):
        self.port = port
        self.host = host
        self.httpd = None
        self.server_thread = None
        self.running = False
        
        # Check if web directory exists
        self.web_dir = Path(__file__).parent / "web"
        if not self.web_dir.exists():
            raise FileNotFoundError(f"Web directory not found: {self.web_dir}")
        
        # Check for required files
        required_files = ['index.html', 'styles.css']
        for file in required_files:
            if not (self.web_dir / file).exists():
                raise FileNotFoundError(f"Required file not found: {file}")
    
    def find_available_port(self, start_port=8000, max_attempts=50):
        """Find an available port starting from start_port"""
        import socket
        
        for port in range(start_port, start_port + max_attempts):
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                try:
                    s.bind((self.host, port))
                    return port
                except OSError:
                    continue
        
        raise Exception(f"Could not find an available port in range {start_port}-{start_port + max_attempts}")
    
    def start(self, auto_open_browser=True):
        """Start the HTTP server"""
        try:
            # Find available port if the default is taken
            try:
                self.httpd = socketserver.TCPServer((self.host, self.port), NBodyHTTPRequestHandler)
            except OSError:
                print(f"Port {self.port} is busy, finding alternative...")
                self.port = self.find_available_port(self.port)
                self.httpd = socketserver.TCPServer((self.host, self.port), NBodyHTTPRequestHandler)
            
            self.running = True
            
            print("=" * 60)
            print("🌌 CelestialSim - Interactive Physics Simulator")
            print("=" * 60)
            print(f"Server starting on: http://{self.host}:{self.port}")
            print(f"Serving from: {self.web_dir}")
            print(f"Press Ctrl+C to stop the server")
            print("=" * 60)
            
            # Start server in a separate thread
            self.server_thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)
            self.server_thread.start()
            
            # Open browser
            if auto_open_browser:
                self.open_browser()
            
            # Keep the main thread alive
            try:
                while self.running:
                    time.sleep(1)
            except KeyboardInterrupt:
                self.stop()
                
        except Exception as e:
            print(f"❌ Error starting server: {e}")
            sys.exit(1)
    
    def open_browser(self, delay=1.5):
        """Open the web browser to the simulation"""
        def open_delayed():
            time.sleep(delay)
            url = f"http://{self.host}:{self.port}"
            print(f"🚀 Opening browser: {url}")
            
            try:
                # Try to open in the default browser
                webbrowser.open(url, new=2)  # new=2 opens in new tab if possible
            except Exception as e:
                print(f"⚠️  Could not auto-open browser: {e}")
                print(f"   Please manually open: {url}")
        
        # Open browser in background thread
        browser_thread = threading.Thread(target=open_delayed, daemon=True)
        browser_thread.start()
    
    def stop(self):
        """Stop the HTTP server"""
        print("\n" + "=" * 60)
        print("🛑 Shutting down CelestialSim server...")
        
        self.running = False
        if self.httpd:
            self.httpd.shutdown()
            self.httpd.server_close()
        
        print("✅ Server stopped successfully")
        print("=" * 60)

def setup_signal_handlers(server):
    """Setup signal handlers for graceful shutdown"""
    def signal_handler(signum, frame):
        server.stop()
        sys.exit(0)
    
    signal.signal(signal.SIGINT, signal_handler)
    if hasattr(signal, 'SIGTERM'):
        signal.signal(signal.SIGTERM, signal_handler)

def print_system_info():
    """Print system information and requirements"""
    print("\nSystem Information:")
    print(f"  Python: {sys.version.split()[0]}")
    print(f"  Platform: {sys.platform}")
    print(f"  Working Directory: {os.getcwd()}")
    
    # Check for modern browser
    print("\nBrowser Compatibility:")
    print("  ✅ Chrome 70+")
    print("  ✅ Firefox 65+")
    print("  ✅ Safari 12+")
    print("  ✅ Edge 79+")

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="CelestialSim Web Server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python run_web.py                    # Start on default port 8000
  python run_web.py --port 3000        # Start on port 3000
  python run_web.py --no-browser       # Don't auto-open browser
  python run_web.py --host 0.0.0.0     # Allow external connections
        """
    )
    
    parser.add_argument(
        '--port', '-p',
        type=int,
        default=8000,
        help='Port to serve on (default: 8000)'
    )
    
    parser.add_argument(
        '--host',
        default='localhost',
        help='Host to bind to (default: localhost)'
    )
    
    parser.add_argument(
        '--no-browser',
        action='store_true',
        help='Do not automatically open web browser'
    )
    
    parser.add_argument(
        '--info',
        action='store_true',
        help='Show system information'
    )
    
    args = parser.parse_args()
    
    if args.info:
        print_system_info()
        return
    
    try:
        # Create and start server
        server = NBodyServer(port=args.port, host=args.host)
        setup_signal_handlers(server)
        server.start(auto_open_browser=not args.no_browser)
        
    except FileNotFoundError as e:
        print(f"❌ Setup Error: {e}")
        print("\n💡 Make sure you're running this script from the project root directory")
        print("   and that all web files are present.")
        sys.exit(1)
    
    except PermissionError:
        print(f"❌ Permission Error: Cannot bind to port {args.port}")
        print("   Try using a port number above 1024 or run as administrator")
        sys.exit(1)
    
    except Exception as e:
        print(f"❌ Unexpected Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
