# Conditional Challenge

A browser extension that lets a lichess player accept or decline incoming challenges automatically, according to rules they configure.

## Language

### Challenges

**Challenge**:
An incoming offer from another player to play a game, shown in the player's challenge list.
_Avoid_: Invitation, request

**Inbox**:
The Challenges a player has received and not yet answered, which can be accepted or declined.
_Avoid_: Queue, list

**Challenger**:
The player who sent a Challenge.
_Avoid_: Opponent, user

**Encounter**:
A past game between the Challenger and the player. Counted in total and for the current day.
_Avoid_: Matchup, previous game

**Provisional rating**:
A Challenger's rating that lichess still marks as unreliable because they have played few rated games.
_Avoid_: Unestablished rating

### Rules

**Profile**:
A named, independent set of rules. Exactly one Profile is active at a time and is the one used on lichess.
_Avoid_: Preset, config

**Rule tree**:
The whole nested AND/OR structure of rules that a Profile holds.
_Avoid_: Criteria, conditions, ruleset

**Rule**:
A leaf of the Rule tree: a comparison of one Field of a Challenge against a value, using a Relation.
_Avoid_: Filter, condition

**Rule group**:
A node of the Rule tree that joins its child rules with a Combinator.
_Avoid_: Sub-rule, branch

**Combinator**:
How a Rule group joins its children: AND (all must hold) or OR (at least one must hold).
_Avoid_: Condition, logical operator

**Field**:
A property of a Challenge or Challenger that a Rule can look at, such as rating, variant or team membership.
_Avoid_: Attribute, criterion

**Relation**:
The comparison a Rule applies, such as less than, between, or in.
_Avoid_: Operator

**Silent rule**:
A Rule marked so that a Challenge failing it is neither accepted nor declined, but left alone.

### Evaluation

**Spec**:
The evaluable form of a Rule tree, which takes a Challenge and yields a Match or a Failure.
_Avoid_: Predicate, matcher

**Match**:
The outcome of a Challenge satisfying the whole Rule tree.
_Avoid_: Pass, hit

**Failure**:
The outcome of a Challenge not satisfying the Rule tree, carrying the reason from the Rule that decided it.
_Avoid_: Mismatch, rejection

**Silent failure**:
A Failure decided by a Silent rule; the Challenge is skipped rather than declined. Which Rule decides is determined by evaluation order: the first failing Rule in an AND, the last Rule in an OR.
_Avoid_: Soft fail, ignored challenge

**Verdict**:
What is done with a Challenge after judging it: accept it (Match), decline it (Failure), or leave it alone (Silent failure).
_Avoid_: Decision, result

**Decline reason**:
The reason lichess is given when a Challenge is declined.

## Relationships

- A **Profile** holds exactly one **Rule tree**.
- A **Rule tree** is made of **Rule groups** and **Rules**; a **Rule group** has a **Combinator** and child nodes.
- A **Rule** is about one **Field** and uses one **Relation**.
- Evaluating a **Challenge** against a **Spec** yields a **Match** or a **Failure**; a **Failure** is either silent or not.
