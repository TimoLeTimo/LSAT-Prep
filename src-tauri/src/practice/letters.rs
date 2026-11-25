//! Finds text that refers to answer choices by letter or position. Such a question must
//! keep its answer order, or the text would point at the wrong choice. When unsure, it
//! says yes: leaving a question unshuffled does no harm.

use crate::import::package::{LABELS, Question};

const CHOICE_WORDS: [&str; 8] =
  ["choice", "choices", "answer", "answers", "option", "options", "response", "responses"];
const POSITION_WORDS: [&str; 13] = [
  "first", "second", "third", "fourth", "fifth", "last", "final", "previous", "preceding", "next",
  "above", "below", "following",
];
/// "Passage B" and "author A" name a text, not a choice.
const TEXT_WORDS: [&str; 6] = ["passage", "passages", "author", "authors", "text", "texts"];

pub fn mentions_choices(question: &Question) -> bool {
  let choices = question.choices.iter().map(|choice| choice.text.as_str());
  let explanations = LABELS.iter().map(|label| question.explanations.get(*label));
  let own = [question.stimulus.as_deref().unwrap_or(""), question.prompt.as_str()];
  own.into_iter().chain(choices).chain(explanations).any(text_mentions_choices)
}

fn text_mentions_choices(text: &str) -> bool {
  // Each word, with the punctuation that touches it.
  let words: Vec<&str> = text.split_whitespace().collect();
  let bare: Vec<&str> =
    words.iter().map(|word| word.trim_matches(|c: char| !c.is_alphanumeric())).collect();
  let lower: Vec<String> = bare.iter().map(|word| word.to_lowercase()).collect();
  let is = |index: Option<usize>, list: &[&str]| {
    index.and_then(|index| lower.get(index)).is_some_and(|word| list.contains(&word.as_str()))
  };

  for index in 0..words.len() {
    let before = index.checked_sub(1);
    // "the second choice", "the choice above", "none of the above"
    let near_choice = is(before, &CHOICE_WORDS) || is(Some(index + 1), &CHOICE_WORDS);
    let of_the = index >= 2 && lower[index - 1] == "the" && lower[index - 2] == "of";
    if is(Some(index), &POSITION_WORDS) && (near_choice || (of_the && lower[index] == "above")) {
      return true;
    }
    // Letters joined to others, such as "B/C" or "A–C".
    let parts: Vec<&str> =
      bare[index].split(|c: char| !c.is_alphanumeric()).filter(|part| !part.is_empty()).collect();
    for part in &parts {
      let is_letter = part.len() == 1 && ("A"..="E").contains(part);
      let is_small_letter = part.len() == 1 && ("a"..="e").contains(part);
      if is_small_letter && (is(before, &CHOICE_WORDS) || parts.len() > 1 || words[index].contains('(')) {
        return true;
      }
      if !is_letter || is_part_of_name(&lower, index) {
        continue;
      }
      // "A" is usually the article, unless something shows it is a label.
      let is_alone = words[index] == "A" && !is(before, &CHOICE_WORDS) && !is_joined(&lower, index);
      if *part != "A" || !is_alone {
        return true;
      }
    }
  }
  false
}

/// "passage B", or "passages A and B".
fn is_part_of_name(lower: &[String], index: usize) -> bool {
  let named = |back: usize| {
    index.checked_sub(back).is_some_and(|at| TEXT_WORDS.contains(&lower[at].as_str()))
  };
  let after_letter = index >= 2
    && ["and", "or"].contains(&lower[index - 1].as_str())
    && lower[index - 2].len() == 1;
  named(1) || (after_letter && named(3))
}

/// "A and C", "B or A", "than A".
fn is_joined(lower: &[String], index: usize) -> bool {
  let is_label = |at: usize| {
    lower.get(at).is_some_and(|word| word.len() == 1 && ("a"..="e").contains(&word.as_str()))
  };
  let joins = |at: usize| {
    lower.get(at).is_some_and(|word| ["and", "or", "nor", "than", "is", "unlike"].contains(&word.as_str()))
  };
  (joins(index + 1) && (is_label(index + 2) || lower[index + 1] == "is"))
    || (index >= 1 && joins(index - 1) && (index + 1 == lower.len() || (index >= 2 && is_label(index - 2))))
}

#[cfg(test)]
mod tests {
  use super::text_mentions_choices;

  #[test]
  fn finds_letters_and_positions() {
    for text in [
      "Choice B is too broad.",
      "Unlike (C), this one is supported.",
      "This is stronger than D.",
      "answer choice a",
      "Both B and E fail.",
      "Both A and C fail.",
      "C or A could work.",
      "A is wrong because it is too strong.",
      "See (A).",
      "Compare \"A\" with the rest.",
      "A: too broad",
      "options a–c",
      "B/C",
      "as in (b)",
      "The second choice is better.",
      "the choice above",
      "None of the above.",
      "Plan B was adopted.",
      "weaker than A",
    ] {
      assert!(text_mentions_choices(text), "{text}");
    }
  }

  #[test]
  fn allows_ordinary_text() {
    for text in [
      "",
      "A letter filed among household bills may reveal something.",
      "The author says a subject scheme embodies choices.",
      "Incorrect. A library can draw more visitors.",
      "Passage B disagrees with passage A.",
      "Both passages A and B mention it.",
      "The author of passage B, unlike the first author, agrees.",
      "It was open until 9 p.m. on weekdays.",
      "the first paragraph and the last sentence",
      "The preceding year was better than a typical one.",
      "a choice and a half",
      "The committee's choice of a site was sound.",
    ] {
      assert!(!text_mentions_choices(text), "{text}");
    }
  }
}
