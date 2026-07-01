"""
text_generator.py - Sentences Assembly Frame (Module 7)
Stores list layers to combine sequential words, clean up outputs, and track history.
"""

class TextGenerator:
    def __init__(self):
        self.words_buffer = []

    def append_word(self, word):
        """Adds a newly classified vocabulary element, adding spaces automatically."""
        if not word:
            return
        # Avoid double-adding identical words rapidly if they dominate adjacent frames
        if len(self.words_buffer) > 0 and self.words_buffer[-1] == word:
             return
        self.words_buffer.append(word)

    def backspace(self):
        """Wipes the last word from the current sentence slate."""
        if len(self.words_buffer) > 0:
            self.words_buffer.pop()

    def clear(self):
        """Resets the accumulated list, clearing the sentence entirely."""
        self.words_buffer = []

    def get_sentence(self):
        """Joins the words lists list using spaces."""
        return " ".join(self.words_buffer)

    def get_structured_statement(self):
        """Translates the raw gesture series into smooth capitalized text."""
        raw = self.get_sentence()
        if not raw:
            return ""
        # Basic offline title casing and punctuation addition
        statement = raw.capitalize()
        # Ensure punctuation is clean
        if not statement.endswith(('.', '?', '!')):
            statement += "."
        return statement

# Instancing
slate_generator = TextGenerator()
