//! Works out what an import would do, without changing anything.

use std::collections::{BTreeMap, BTreeSet};

use rusqlite::Connection;
use serde::Serialize;

use super::{
  package::{Package, Section},
  store,
};

/// What would happen to each kind of item. Lists hold IDs.
#[derive(Serialize, Debug, Default, Clone, PartialEq)]
pub struct Items {
  pub new: Vec<String>,
  /// Already in the app with identical content; left alone.
  pub skipped: Vec<String>,
  /// Already in the app with different content; blocks the import.
  pub conflicts: Vec<String>,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct CategoryCount {
  pub id: String,
  pub questions: usize,
}

#[derive(Serialize, Debug, Clone, PartialEq)]
pub struct Plan {
  pub package_id: String,
  pub package_version: String,
  pub display_name: String,
  pub content_hash: String,
  pub lr_questions: usize,
  pub rc_questions: usize,
  pub questions_by_category: Vec<CategoryCount>,
  pub categories: Items,
  pub passages: Items,
  pub questions: Items,
  /// Reasons the import is not allowed. Empty means it can be confirmed.
  pub problems: Vec<String>,
}

pub fn make(conn: &Connection, package: &Package, hash: &str) -> rusqlite::Result<Plan> {
  let categories = sort(&package.categories, |item| &item.id, |id| store::load_category(conn, id))?;
  let passages = sort(&package.passages, |item| &item.id, |id| store::load_passage(conn, id))?;
  let questions = sort(&package.questions, |item| &item.id, |id| store::load_question(conn, id))?;

  let mut counts = BTreeMap::<&str, usize>::new();
  for question in &package.questions {
    *counts.entry(&question.primary_category).or_default() += 1;
  }
  let lr_questions =
    package.questions.iter().filter(|item| item.section == Section::LogicalReasoning).count();

  let mut plan = Plan {
    package_id: package.package_id.clone(),
    package_version: package.package_version.clone(),
    display_name: package.display_name.clone(),
    content_hash: hash.to_owned(),
    lr_questions,
    rc_questions: package.questions.len() - lr_questions,
    questions_by_category: counts
      .into_iter()
      .map(|(id, questions)| CategoryCount { id: id.to_owned(), questions })
      .collect(),
    categories,
    passages,
    questions,
    problems: Vec::new(),
  };
  plan.problems = problems(conn, package, &plan)?;
  Ok(plan)
}

fn problems(conn: &Connection, package: &Package, plan: &Plan) -> rusqlite::Result<Vec<String>> {
  let already: bool = conn.query_row(
    "SELECT EXISTS (SELECT 1 FROM content_packages WHERE package_id = ?1 AND package_version = ?2)",
    [&package.package_id, &package.package_version],
    |row| row.get(0),
  )?;
  if already {
    return Ok(vec!["This version of the package has already been imported.".into()]);
  }

  let mut problems = Vec::new();
  for (items, name) in [
    (&plan.categories, "category"),
    (&plan.passages, "passage"),
    (&plan.questions, "question"),
  ] {
    for id in &items.conflicts {
      problems.push(format!(
        "The {name} “{id}” is already in the app with different content. Nothing is ever overwritten."
      ));
    }
  }

  // Questions being added need an approved passage and a category of the same section.
  let new_questions: BTreeSet<_> = plan.questions.new.iter().collect();
  let new_passages: BTreeSet<_> = plan.passages.new.iter().collect();
  let new_categories: BTreeMap<_, _> =
    package.categories.iter().map(|item| (&item.id, item.section)).collect();
  for question in package.questions.iter().filter(|item| new_questions.contains(&item.id)) {
    if let Some(id) = &question.passage_id
      && !new_passages.contains(id)
      && store::passage_status(conn, id)?.as_deref() != Some("approved")
    {
      problems.push(format!("The question “{}” needs a passage that is not available.", question.id));
    }
    let category = &question.primary_category;
    let section = match new_categories.get(category) {
      Some(section) => Some(*section),
      None => store::load_category(conn, category)?.map(|item| item.section),
    };
    if section != Some(question.section) {
      problems.push(format!("The question “{}” needs a category that is not available.", question.id));
    }
  }

  if problems.is_empty() && plan.questions.new.is_empty() {
    problems.push("Every question in this package is already in the app.".into());
  }
  Ok(problems)
}

/// Sorts package items into new, identical, and conflicting.
fn sort<T: PartialEq>(
  items: &[T],
  id: impl Fn(&T) -> &String,
  load: impl Fn(&str) -> rusqlite::Result<Option<T>>,
) -> rusqlite::Result<Items> {
  let mut sorted = Items::default();
  for item in items {
    let list = match load(id(item))? {
      None => &mut sorted.new,
      Some(existing) if existing == *item => &mut sorted.skipped,
      Some(_) => &mut sorted.conflicts,
    };
    list.push(id(item).clone());
  }
  Ok(sorted)
}
