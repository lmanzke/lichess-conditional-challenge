import { Effect } from 'effect';
import { findField } from '@/challenge/fields';
import { compare, mapRelation } from '@/challenge/relations';
import { DeclineReason, isRuleGroup, type Combinator, type Rule, type RuleNode, type Spec } from '@/challenge/types';

export const anySpec: Spec = () => Effect.succeed({ isSatisfied: true });
export const noneSpec: Spec = () => Effect.succeed({ isSatisfied: false, silent: false, reason: DeclineReason.RULE_FAILED });

/** Short-circuits: `second` only runs (and only causes requests) if `first` is satisfied. */
export const andSpec =
  (first: Spec, second: Spec): Spec =>
  challenge =>
    Effect.flatMap(first(challenge), result => (result.isSatisfied ? second(challenge) : Effect.succeed(result)));

/** Short-circuits: `second` only runs if `first` is not satisfied. */
export const orSpec =
  (first: Spec, second: Spec): Spec =>
  challenge =>
    Effect.flatMap(first(challenge), result => (result.isSatisfied ? Effect.succeed(result) : second(challenge)));

/** Folds specs with the combinator. Empty AND is always satisfied, empty OR never. */
export const combineSpecs = (combinator: Combinator, specs: Spec[]): Spec => (combinator === 'AND' ? specs.reduce(andSpec, anySpec) : specs.reduce(orSpec, noneSpec));

/** A rule is satisfied if the relation holds between the field of the challenge and the value of the rule. */
const ruleSpec = (rule: Rule): Spec => {
  const field = findField(rule.field);
  const value = field.coerce(rule.value);
  const holds = compare(mapRelation(rule.relation))(value);

  return challenge =>
    Effect.map(field.test(challenge, holds), satisfied => (satisfied ? { isSatisfied: true } : { isSatisfied: false, silent: rule.silent, reason: field.declineReason(value) }));
};

export const convertRule = (node: RuleNode): Spec => (isRuleGroup(node) ? combineSpecs(node.combinator, node.children.map(convertRule)) : ruleSpec(node));
