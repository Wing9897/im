"""Contract test suite for the v3 rebuild.

Invariant under test: frontend API contract (camelCase wire shapes).
for every route, response keys ⊇ the keys the frontend actually reads.
"""
