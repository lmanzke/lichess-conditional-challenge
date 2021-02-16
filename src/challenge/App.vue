<template>
  <div class="extender">
    <button @click="acceptMatchingClicked">Accept matching challenge</button>
    <button @click="declineUnmatchingClicked">Decline all unmatching</button>
  </div>
</template>

<script lang="ts">
import { convertRuleReader, getChallengeElement, getChallengeInfosReader } from '@/challenge/lichess';
import { getLichessPrefs } from '@/challenge/storage';
import { defineComponent, provide } from 'vue';
import { JpexInstance } from 'jpex';
import * as RT from 'fp-ts/ReaderTask';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import * as SRTE from 'fp-ts/StateReaderTaskEither';
import { sequenceArray } from 'fp-ts/StateReaderTaskEither';
import { Endomorphism, flow, pipe } from 'fp-ts/function';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import { AxiosInstance } from 'axios';
import { ensureNonEmptyArrayReader, fromIOSpecReader, ofSpecReader, safeRandomElement, sequenceReaderTaskEither, tap3, tap4 } from '@/challenge/utils';
import {
  AppProps,
  Challenge,
  ChallengeInfo,
  challengeInfoIsUnsatisfied,
  CheckedCondition,
  DeclineReason,
  ReaderTypeOf,
  Rule,
  SatisfyingChallengeInfo,
  Spec,
  SpecReaderTypeOf,
  SpecResult,
  specResultIsSatisfied,
  UnsatisfyingChallengeInfo,
} from '@/challenge/types';
import { filter } from 'fp-ts/Array';

const tapRTE = tap4(SRTE.stateReaderTaskEither);
const _logValue: Endomorphism<SpecReaderTypeOf<unknown>> = tapRTE(console.log);

type SpecProcessorForChallenges = ([spec, challenges]: [Spec, Challenge[]]) => SpecReaderTypeOf<string[]>;

const matchFirstRandom = (spec: Spec, challenges: Challenge[]) => pipe(challenges, ensureNonEmptyArrayReader, SRTE.chain(getFirstRandomChallenge(spec)));

const getFirstRandomChallenge = (spec: Spec) => (challenges: NonEmptyArray<Challenge>): SpecReaderTypeOf<SatisfyingChallengeInfo> => {
  const { current, other } = safeRandomElement(challenges);

  return pipe(
    current,
    spec,
    SRTE.chain(specResult => {
      if (specResultIsSatisfied(specResult)) {
        return ofSpecReader({ challenge: current, isSatisfied: true });
      }
      if (specResult.silent) {
        return matchFirstRandom(spec, other);
      }

      return pipe(
        fromIOSpecReader(current.decline(specResult.reason)),
        SRTE.chain(() => matchFirstRandom(spec, other))
      );
    })
  );
};

const declinedToString = (challengeInfo: UnsatisfyingChallengeInfo): string => {
  return ' a rule failed.';
};

const acceptChallengeInfo = (challengeInfo: ChallengeInfo): SpecReaderTypeOf<string[]> =>
  pipe(
    fromIOSpecReader(challengeInfo.challenge.accept),
    SRTE.map(() => ['Accepted a challenge'])
  );

const tryGetSpecReader = pipe(getLichessPrefs, TE.map(convertRuleReader));
const tryGetSpecWithChallenges = flow(
  getChallengeElement,
  RTE.fromIOEither,
  RTE.chain(element => sequenceReaderTaskEither(RTE.fromTaskEither<AxiosInstance, Error, Spec>(tryGetSpecReader), getChallengeInfosReader(element)))
);
const acceptFirstMatchingChallengeProcessor: SpecProcessorForChallenges = ([spec, challenges]) => pipe(matchFirstRandom(spec, challenges), SRTE.chain(acceptChallengeInfo));

const executeSpec = (spec: Spec) => (challenge: Challenge): SpecReaderTypeOf<ChallengeInfo> => {
  return pipe(
    challenge,
    spec,
    SRTE.map<SpecResult, ChallengeInfo>(result => ({ ...result, challenge }))
  );
};
const declineUnsatisfiedChallenges = (unsatisfiedChallenges: UnsatisfyingChallengeInfo[]): SpecReaderTypeOf<string[]> =>
  pipe(
    fromIOSpecReader(() => {
      const unsilentChallenges = unsatisfiedChallenges.filter(unsatisfiedChallenge => !unsatisfiedChallenge.silent);
      unsilentChallenges.forEach(unsilentChallenge => {
        unsilentChallenge.challenge.decline(DeclineReason.RULE_FAILED)();
      });

      return unsilentChallenges;
    }),
    SRTE.map(unsilentChallenges =>
      unsilentChallenges.map(unsilentChallenge => {
        const reasonString = declinedToString(unsilentChallenge);

        return `Declined ${unsilentChallenge.challenge.id}(${unsilentChallenge.challenge.username}) because ${reasonString}`;
      })
    ),
    SRTE.chainFirst(challengeInfos => SRTE.fromIO(() => challengeInfos.forEach(console.log)))
  );

const declineAllUnmatchingProcessor: SpecProcessorForChallenges = ([spec, challenges]) =>
  pipe(
    challenges.map(executeSpec(spec)),
    sequenceArray,
    SRTE.map(v => filter(challengeInfoIsUnsatisfied)(v as ChallengeInfo[])),
    SRTE.chain(declineUnsatisfiedChallenges)
  );

const acceptFirstMatchingForElement = flow(tryGetSpecWithChallenges, SRTE.fromReaderTaskEither, SRTE.chain(acceptFirstMatchingChallengeProcessor));
const declineAllUnmatchingForElement = flow(tryGetSpecWithChallenges, SRTE.fromReaderTaskEither, SRTE.chain(declineAllUnmatchingProcessor));

function foldSRTE<S, R, E, A, B>(
  onLeft: (left: [E, S]) => RT.ReaderTask<R, B>,
  onRight: (right: [A, S]) => RT.ReaderTask<R, B>
): (ma: SRTE.StateReaderTaskEither<S, R, E, A>) => (s: S) => RT.ReaderTask<R, B> {
  return ma => s => r =>
    pipe(
      ma(s)(r),
      TE.fold(
        e => onLeft([e, s])(r),
        a => onRight(a)(r)
      )
    );
}

const logResult = foldSRTE<CheckedCondition[], AxiosInstance, Error, string[], void>(
  ([error, checkedConditions]) => RT.fromIO(() => console.log(error.message, checkedConditions)),
  ([right, checkedConditions]) => RT.fromIO(() => console.log(right, checkedConditions))
);

const logAcceptFirstMatchingForElement = flow(acceptFirstMatchingForElement, logResult);
const logDeclineAllUnmatchingForElement = flow(declineAllUnmatchingForElement, logResult);

export default defineComponent({
  props: {
    container: {
      type: HTMLElement,
      required: true,
    },
    dependencies: {
      type: Object as () => JpexInstance,
      required: true,
    },
  },
  setup(props: AppProps) {
    provide('dependencies', props.dependencies);
    const http = props.dependencies.resolve<AxiosInstance>('axios');

    const acceptMatchingClicked = logAcceptFirstMatchingForElement(props.container)([])(http);
    const declineUnmatchingClicked = logDeclineAllUnmatchingForElement(props.container)([])(http);

    return {
      acceptMatchingClicked,
      declineUnmatchingClicked,
    };
  },
});
</script>
<style lang="scss">
.extender {
  background-color: #fff;
}

.extender button {
  width: 100%;
  padding: 12px 0;
  margin: 1px 1px 0 1px;
  text-transform: uppercase;
  line-height: 1.5;
  transition: all 150ms;
  background: none;
  border: none;
  outline: none;
  color: #777777 !important;

  &:hover {
    background: #89b25b;
    color: #fff !important;
  }
}
</style>
