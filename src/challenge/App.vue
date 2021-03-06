<template>
  <div class="extender">
    <button @click="acceptMatchingClicked">Accept matching challenge</button>
    <button @click="declineUnmatchingClicked">Decline all unmatching</button>
    <button v-if="devMode" @click="logInfoClicked">Log info</button>
  </div>
</template>

<script lang="ts">
import { convertRuleReader, getChallengeElement, getChallengeInfosReader } from '@/challenge/lichess';
import { getLichessPrefs } from '@/challenge/storage';
import { computed, defineComponent, provide } from 'vue';
import { JpexInstance } from 'jpex';
import * as RT from 'fp-ts/ReaderTask';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { Endomorphism, flow, pipe } from 'fp-ts/function';
import { NonEmptyArray } from 'fp-ts/NonEmptyArray';
import { AxiosInstance } from 'axios';
import { ensureNonEmptyArrayReader, fromIOSpecReader, isDevMode, ofSpecReader, safeRandomElement, sequenceReaderTaskEither, tap3 } from '@/challenge/utils';
import { sequenceArray } from 'fp-ts/ReaderTaskEither';
import {
  ChallengeInfo,
  ReaderTypeOf,
  AppProps,
  Spec,
  Challenge,
  Rule,
  SpecResult,
  challengeInfoIsUnsatisfied,
  specResultIsSatisfied,
  SatisfyingChallengeInfo,
  UnsatisfyingChallengeInfo,
} from '@/challenge/types';
import { filter } from 'fp-ts/Array';

const tapRTE = tap3(RTE.readerTaskEither);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _logValue: Endomorphism<ReaderTypeOf<any>> = tapRTE(console.log);
const readerTryLichessPrefs: ReaderTypeOf<Rule> = pipe(getLichessPrefs, RTE.fromTaskEither);

type SpecProcessorForChallenges = ([spec, challenges]: [Spec, Challenge[]]) => RTE.ReaderTaskEither<AxiosInstance, Error, string>;

const matchFirstRandom = (spec: Spec, challenges: Challenge[]) => pipe(challenges, ensureNonEmptyArrayReader, RTE.chain(getFirstRandomChallenge(spec)));

const getFirstRandomChallenge = (spec: Spec) => (challenges: NonEmptyArray<Challenge>): ReaderTypeOf<SatisfyingChallengeInfo> => {
  const { current, other } = safeRandomElement(challenges);

  return pipe(
    current,
    spec,
    RTE.chain(specResult => {
      if (specResultIsSatisfied(specResult)) {
        return ofSpecReader({ challenge: current, isSatisfied: true });
      }
      if (specResult.silent) {
        return matchFirstRandom(spec, other);
      }

      return pipe(
        fromIOSpecReader(current.decline(specResult.reason)),
        RTE.chain(() => matchFirstRandom(spec, other))
      );
    })
  );
};

const acceptChallengeInfo = (challengeInfo: ChallengeInfo): ReaderTypeOf<string> =>
  pipe(
    fromIOSpecReader(challengeInfo.challenge.accept),
    RTE.map(() => 'Accepted a challenge')
  );

const tryGetSpecReader = pipe(
  readerTryLichessPrefs,
  RTE.chain(rule => RTE.of(convertRuleReader(rule)))
);
const tryGetSpecWithChallenges = flow(
  getChallengeElement,
  RTE.fromIOEither,
  RTE.chain(element => sequenceReaderTaskEither(tryGetSpecReader, getChallengeInfosReader(element)))
);
const acceptFirstMatchingChallengeProcessor: SpecProcessorForChallenges = ([spec, challenges]) => pipe(matchFirstRandom(spec, challenges), RTE.chain(acceptChallengeInfo));

const executeSpec = (spec: Spec) => (challenge: Challenge): ReaderTypeOf<ChallengeInfo> => {
  return pipe(
    challenge,
    spec,
    RTE.map<SpecResult, ChallengeInfo>(result => ({ ...result, challenge }))
  );
};
const declineUnsatisfiedChallenges = (unsatisfiedChallenges: UnsatisfyingChallengeInfo[]): ReaderTypeOf<string> =>
  RTE.fromIO(() => {
    const unsilentChallenges = unsatisfiedChallenges.filter(unsatisfiedChallenge => !unsatisfiedChallenge.silent);
    unsilentChallenges.forEach(unsilentChallenge => {
      unsilentChallenge.challenge.decline(unsilentChallenge.reason)();
    });

    return 'Declined ' + unsilentChallenges.length + ' challenges';
  });

const declineAllUnmatchingProcessor: SpecProcessorForChallenges = ([spec, challenges]) =>
  pipe(
    challenges.map(executeSpec(spec)),
    sequenceArray,
    RTE.map(v => filter(challengeInfoIsUnsatisfied)(v as ChallengeInfo[])),
    RTE.chain(declineUnsatisfiedChallenges)
  );

const acceptFirstMatchingForElement = flow(tryGetSpecWithChallenges, RTE.chain(acceptFirstMatchingChallengeProcessor));
const declineAllUnmatchingForElement = flow(tryGetSpecWithChallenges, RTE.chain(declineAllUnmatchingProcessor));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const logResult = RTE.fold<AxiosInstance, Error, any, void>(
  left => RT.fromIO(() => console.log(left.message)),
  right => RT.fromIO(() => console.log(right))
);
const logAcceptFirstMatchingForElement = flow(acceptFirstMatchingForElement, logResult);
const logDeclineAllUnmatchingForElement = flow(declineAllUnmatchingForElement, logResult);

const logInfo = (container: HTMLElement) =>
  pipe(
    RTE.bindTo('rules')(readerTryLichessPrefs),
    RTE.bind('specs', () =>
      pipe(
        container,
        tryGetSpecWithChallenges,
        RTE.map(([spec, challenges]) => ({ spec, challenges }))
      )
    ),
    logResult
  );

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

    const acceptMatchingClicked = logAcceptFirstMatchingForElement(props.container)(http);
    const declineUnmatchingClicked = logDeclineAllUnmatchingForElement(props.container)(http);
    const logInfoClicked = logInfo(props.container)(http);
    const devMode = computed(() => isDevMode());

    return {
      acceptMatchingClicked,
      declineUnmatchingClicked,
      logInfoClicked,
      devMode,
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
