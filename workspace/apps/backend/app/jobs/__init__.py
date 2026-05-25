"""Background jobs package — R30.

Currently hosts the tmp-upload sweep. Future rounds may add other
background tasks following the same shape (lifespan-spawned
asyncio task + CLI one-shot entry point + tests).
"""
