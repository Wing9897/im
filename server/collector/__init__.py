"""Collector: platform adapters (Telegram/Discord/RSS/MQTT/Email) + lifecycle manager.

Heavy platform client libraries are imported lazily inside the adapter
modules, so this package imports cleanly without them installed.
"""
