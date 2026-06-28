#  Tests for backend/app/chat.py — the model-free pieces (op vocabulary + filter).
#  We do NOT load the HF model here; we pin the contract that guards against the vocabulary drift
#  the code review flagged (LLM vocabulary must equal what frontend/src/models/applyIntent.js runs).

import unittest

from backend.app.chat import _filter_ops, OPS


class FilterOps(unittest.TestCase):
    def test_keeps_supported_ops(self):
        ops = [{"op": "remove_source", "name": "s"}, {"op": "explain"}]
        self.assertEqual(_filter_ops(ops), ops)

    def test_drops_unknown_and_malformed(self):
        self.assertEqual(_filter_ops([{"op": "nope"}, "x", 3, {}]), [])

    def test_non_list_is_empty(self):
        self.assertEqual(_filter_ops(None), [])

    def test_vocabulary_matches_executor(self):
        # If this fails, chat.py and applyIntent.js have drifted again. Re-sync them.
        self.assertEqual(OPS, {
            "add_columns", "remove_column", "rename_column",
            "add_source", "remove_source",
            "add_transform", "remove_transform",
            "add_filter", "set_output", "explain", "none",
        })


if __name__ == "__main__":
    unittest.main()
