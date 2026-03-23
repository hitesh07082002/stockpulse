import os


bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"
workers = int(os.getenv('WEB_CONCURRENCY', '2'))
worker_class = 'gthread'
threads = 4
timeout = 120
accesslog = '-'
errorlog = '-'
preload_app = True
