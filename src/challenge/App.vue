<template>
  <div class="extender">
    <button class="fbt" @click="acceptMatchingClicked">Accept matching challenge</button>
    <button class="fbt" @click="declineUnmatchingClicked">Decline all unmatching</button>
  </div>
</template>

<script lang="ts">
import {
  Challenge,
  ChallengeProcessor,
  ChallengeRetriever,
  declineUnmatchingFactory,
  getChallengeElement,
  processChallengesFactory,
  RuleConverter,
  Spec,
} from '@/challenge/lichess';
import { getLichessPrefs } from '@/challenge/storage';
import { defineComponent, provide } from 'vue';
import { JpexInstance } from 'jpex';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as RT from 'fp-ts/ReaderTask';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as IO from 'fp-ts/IO';
import { flow, pipe } from 'fp-ts/function';
import { sequenceT } from 'fp-ts/Apply';
import { array } from 'fp-ts/Array';
import { fromArray, head, NonEmptyArray } from 'fp-ts/NonEmptyArray';

interface Props {
  container: HTMLElement;
  dependencies: JpexInstance;
}
type ReaderDeps = {
  retrieveChallenge: ChallengeRetriever;
  convertRule: RuleConverter;
  challengeProcessorFactory: (spec: Spec) => ChallengeProcessor;
};

type ChallengeInfo = {
  challenge: Challenge;
  silent: boolean;
};

const sequenceTaskEither = sequenceT(TE.taskEither);
const lichessPrefTask = (convertRule: RuleConverter): TE.TaskEither<Error, Spec> =>
  pipe(
    TE.tryCatch(
      () => getLichessPrefs(),
      reason => Error(String(reason))
    ),
    TE.chain(rule => TE.right(convertRule(rule)))
  );
const retrieveChallengeTask = (challengeElement: HTMLDivElement, retrieveChallenge: ChallengeRetriever) =>
  TE.tryCatch(
    () => retrieveChallenge(challengeElement),
    reason => Error(String(reason))
  );

const processChallenges: (
  args: [Spec, Challenge[]]
) => RTE.ReaderTaskEither<
  { retrieveChallenge: ChallengeRetriever; convertRule: RuleConverter; challengeProcessorFactory: (spec: Spec) => ChallengeProcessor },
  Error,
  { challenge: Challenge; silent: boolean }[]
> = ([spec, challenges]) => r => {
  return TE.fromTask(() => {
    const challengeProcessor = r.challengeProcessorFactory(spec);
    return challengeProcessor(challenges, []);
  });
};

const retrieveData = (
  challengeElement: HTMLDivElement
): RTE.ReaderTaskEither<{ retrieveChallenge: ChallengeRetriever; convertRule: RuleConverter }, Error, [Spec, Challenge[]]> => r =>
  sequenceTaskEither(lichessPrefTask(r.convertRule), retrieveChallengeTask(challengeElement, r.retrieveChallenge));

const ensureChallenge = (challengeInfo: ChallengeInfo[]) => {
  const nea = fromArray(challengeInfo);
  const neaEither = E.fromOption(() => Error('No matching challenge'))(nea);
  return RTE.fromEither<ReaderDeps, Error, NonEmptyArray<ChallengeInfo>>(neaEither);
};

const acceptFirstChallenge = flow(
  RTE.chain(ensureChallenge),
  RTE.map(head),
  RTE.chain(challenge => RTE.fromIO(challenge.challenge.accept))
);

const declineAllChallenges = RTE.chain<ReaderDeps, Error, ChallengeInfo[], void>(challengeInfos =>
  pipe(
    challengeInfos,
    v => v.map(challengeInfo => challengeInfo.challenge.decline),
    array.sequence(IO.io),
    IO.map(() => {}),
    v => RTE.fromIO<ReaderDeps, Error, void>(v)
  )
);

const processContainerWithDeps = (container: HTMLElement, e: (ma: RTE.ReaderTaskEither<ReaderDeps, Error, ChallengeInfo[]>) => RTE.ReaderTaskEither<ReaderDeps, Error, void>) =>
  pipe(
    getChallengeElement(container),
    RTE.fromIOEither,
    RTE.chain(retrieveData),
    RTE.chain(processChallenges),
    e,
    RTE.fold(
      error => RT.fromIO(() => console.log(error)),
      () =>
        RT.fromIO(() => {
          console.log('Challenges processed');
        })
    )
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
  setup(props: Props) {
    provide('dependencies', props.dependencies);
    const ruleConverter = props.dependencies.resolve<RuleConverter>('ruleConverter');
    const challengeRetriever = props.dependencies.resolve<ChallengeRetriever>('challengeRetriever');

    return {
      acceptMatchingClicked: processContainerWithDeps(
        props.container,
        acceptFirstChallenge
      )({
        retrieveChallenge: challengeRetriever,
        convertRule: ruleConverter,
        challengeProcessorFactory: processChallengesFactory,
      }),
      declineUnmatchingClicked: processContainerWithDeps(
        props.container,
        declineAllChallenges
      )({
        retrieveChallenge: challengeRetriever,
        convertRule: ruleConverter,
        challengeProcessorFactory: declineUnmatchingFactory,
      }),
    };
  },
});
</script>
<style>
.extender {
  background-color: #fff;
}

.extender button {
  width: 100%;
  padding: 15px 0;
}
</style>
