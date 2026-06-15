# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## 3.0.0 (2026-06-12)

* feat: add number of valid vote options ([cdba5a3](https://github.com/privacy-scaling-explorations/maci/commit/cdba5a3))
* feat: add poll state tree depth ([3d74d4b](https://github.com/privacy-scaling-explorations/maci/commit/3d74d4b))
* feat: add start and end timestmap for poll ([cf67b53](https://github.com/privacy-scaling-explorations/maci/commit/cf67b53))
* feat: anonymous poll joining milestone 1 (#1625) ([5566cfe](https://github.com/privacy-scaling-explorations/maci/commit/5566cfe)), closes [#1625](https://github.com/privacy-scaling-explorations/maci/issues/1625)
* feat: anonymous poll joining milestone 2 and 3 (#1750) ([47d6937](https://github.com/privacy-scaling-explorations/maci/commit/47d6937)), closes [#1750](https://github.com/privacy-scaling-explorations/maci/issues/1750)
* feat: rebase anon poll joining with dev ([c384a5b](https://github.com/privacy-scaling-explorations/maci/commit/c384a5b))
* feat: voice credits per poll (#1967) ([f59e9c3](https://github.com/privacy-scaling-explorations/maci/commit/f59e9c3)), closes [#1967](https://github.com/privacy-scaling-explorations/maci/issues/1967)
* feat(coordinator): submit on chain using SDK ([a8fac26](https://github.com/privacy-scaling-explorations/maci/commit/a8fac26))
* feat(sdk): add relayer functions ([6273ef8](https://github.com/privacy-scaling-explorations/maci/commit/6273ef8))
* feat(sdk): implement Subgraph fetcher for signup tree (#2479) ([f6c2b7f](https://github.com/privacy-scaling-explorations/maci/commit/f6c2b7f)), closes [#2479](https://github.com/privacy-scaling-explorations/maci/issues/2479)
* feat(subgraph): add chain hashes and ipfs messages to subgraph ([cb139ea](https://github.com/privacy-scaling-explorations/maci/commit/cb139ea))
* feat(subgraph): add PollJoined handler and registrationCount #2803 ([c14fc17](https://github.com/privacy-scaling-explorations/maci/commit/c14fc17)), closes [#2803](https://github.com/privacy-scaling-explorations/maci/issues/2803)
* chore: add publishConfig (#2308) ([26f28d6](https://github.com/privacy-scaling-explorations/maci/commit/26f28d6)), closes [#2308](https://github.com/privacy-scaling-explorations/maci/issues/2308)
* chore: move packages to @maci org (#2286) ([7275509](https://github.com/privacy-scaling-explorations/maci/commit/7275509)), closes [#2286](https://github.com/privacy-scaling-explorations/maci/issues/2286)
* chore: use type imports ([9da523a](https://github.com/privacy-scaling-explorations/maci/commit/9da523a))
* chore(deps-dev): bump wabt from 1.0.36 to 1.0.37 ([5611907](https://github.com/privacy-scaling-explorations/maci/commit/5611907))
* chore(deps): bump @graphprotocol/graph-cli from 0.88.0 to 0.95.0 (#2069) ([46da711](https://github.com/privacy-scaling-explorations/maci/commit/46da711)), closes [#2069](https://github.com/privacy-scaling-explorations/maci/issues/2069)
* chore(deps): bump @graphprotocol/graph-cli from 0.95.0 to 0.96.0 ([aa88b9a](https://github.com/privacy-scaling-explorations/maci/commit/aa88b9a))
* chore(deps): bump @graphprotocol/graph-cli from 0.96.0 to 0.97.0 ([b3f22af](https://github.com/privacy-scaling-explorations/maci/commit/b3f22af))
* chore(deps): bump @graphprotocol/graph-cli from 0.97.0 to 0.97.1 ([8f6952e](https://github.com/privacy-scaling-explorations/maci/commit/8f6952e))
* chore(deps): bump @graphprotocol/graph-ts from 0.35.1 to 0.37.0 ([c355be3](https://github.com/privacy-scaling-explorations/maci/commit/c355be3))
* chore(deps): bump @graphprotocol/graph-ts from 0.37.0 to 0.38.0 ([8057e4a](https://github.com/privacy-scaling-explorations/maci/commit/8057e4a))
* chore(deps): bump @graphprotocol/graph-ts from 0.38.0 to 0.38.1 ([f3eea92](https://github.com/privacy-scaling-explorations/maci/commit/f3eea92))
* fix: add missing parts after anon poll joining rebase ([6349806](https://github.com/privacy-scaling-explorations/maci/commit/6349806))
* fix: ensure is-tallied and totalSignups are correct (#2503) ([6380833](https://github.com/privacy-scaling-explorations/maci/commit/6380833)), closes [#2503](https://github.com/privacy-scaling-explorations/maci/issues/2503)
* fix: update subgraph schema ([bd0e401](https://github.com/privacy-scaling-explorations/maci/commit/bd0e401))
* refactor: expand shorthand variables to full names ([75547c0](https://github.com/privacy-scaling-explorations/maci/commit/75547c0))
* refactor(circuits): rename circuits signal inputs and move templates ([c2f4e36](https://github.com/privacy-scaling-explorations/maci/commit/c2f4e36))


### BREAKING CHANGE

* message processing is changed

* fix(ipoll): add missing parameter

* fix(poll-tests): add missing parameter maxMessagebatchSize

* feat(poll.ts): add chain hash updating

* test(poll tests): add test for checking chain hash computation

* feat(poll.ts): add batch hashes array computation

* feat(poll.sol): pad zeroes to the maximum size of batch

* feat(messageprocessor): update process messages to use chain hash

* refactor(vkregistry): refactor function call

* feat(processmessages.circom): add chainHash feature in circuits and test for that

* test(processmessages): rearrange test for key-change

* refactor(mergemessages): refactor functions calls which include mergemessages

* refactor(mergemessages): add some more changes about functions call which  include mergemessages

* test(all tests): fixing tests after refactoring code

* refactor(accqueue): remove all calls for accqueue

* fix(currentmessagebatchindex): fix message batch indexing

* refactor(circuit tests): refactor code for circuit testing

* test(ceremonyparams.test): correct constants for CeremonyParams test

* perf(processmessages.circom + contracts): optimize last batch padding, remove unused inputs

* docs(padlastbatch method): update doc comment

* docs(poll.ts): remove stale comments

* docs(test comments): fix typos

* ci(treedepths mock): modify interface for mocked function

* fix(ceremony params test): fix circuit inputs

* test(messagevalidator): fix function calls for messagevalidator circuit in tests

* chore(comments): fix unusefull comments

* refactor(poll.sol): replace external contracts with maci only

* perf(messageprocessor.sol): hardcode initialization for batchHashes array

* docs(comments): fix some more comments

* test(test for pr checks): correct some of tests for PR checks

* ci: 🎡 renamed old ProcessMessages_10-2-1-2_test

* ci: 🎡 correct rapidsnark/build/prover path

* style(reviews): solve some reviews for merging

* refactor(messageaqq): remove more message merging and message aqq

* style(messageaqq): remove more message merging and message aqq

* refactor(messageaqq): remove message aqq from subgraph

* test(coordinator): hide NOT_MERGED_MESSAGE_TREE error

* test(coordinator): fix test about message merging

* test(proveonchain): change chainHash calculation

* test(proveonchain): fix chainHashes declaration

* test(proveonchain): fix chainHash calculation

* test(proveonchain): fix chainHashes calculations

* test(proveonchain): fix chainHashes calculation

* test(proveonchain): fix loop limit

* style(review comments): resolve some of review comments

* style(review comments): resolve some of review comments

* test(lint:ts): fix e2e test because of lint:ts check

* docs(wrong changes): fix wrong changes about documentation that is not in our scope

* refactor(batchsizes): change batchSizes struct with messageBatchSize variable

* refactor(contracts): rollback to provide external contract references

* docs(messageprocessor.sol): fix typo

* refactor(messagebatchsize): chenge messageBatchSize location from Params.sol to Poll.sol

* refactor(maxmessages): remove maxMessages from maxValues

* refactor(sltimestemp): remove slTimestamp from circuits

* refactor(review comments): resolve more review comments

* fix(subgraph): fix bug about maxVoteOptions dunction call

* fix(sltimestamp): fix test for removing slTimestap signal

* refactor(promise.all): refactor promise.all for only one async call

* fix(subgraph): try to fix subgraph build

* revert(.nx folder): remove .nx folder from cli folder
* message processing is changed

* fix(ipoll): add missing parameter

* fix(poll-tests): add missing parameter maxMessagebatchSize

* feat(poll.ts): add chain hash updating

* test(poll tests): add test for checking chain hash computation

* feat(poll.ts): add batch hashes array computation

* feat(poll.sol): pad zeroes to the maximum size of batch

* feat(messageprocessor): update process messages to use chain hash

* refactor(vkregistry): refactor function call

* feat(processmessages.circom): add chainHash feature in circuits and test for that

* test(processmessages): rearrange test for key-change

* refactor(mergemessages): refactor functions calls which include mergemessages

* refactor(mergemessages): add some more changes about functions call which  include mergemessages

* test(all tests): fixing tests after refactoring code

* refactor(accqueue): remove all calls for accqueue

* fix(currentmessagebatchindex): fix message batch indexing

* refactor(circuit tests): refactor code for circuit testing

* test(ceremonyparams.test): correct constants for CeremonyParams test

* perf(processmessages.circom + contracts): optimize last batch padding, remove unused inputs

* docs(padlastbatch method): update doc comment

* docs(poll.ts): remove stale comments

* docs(test comments): fix typos

* ci(treedepths mock): modify interface for mocked function

* fix(ceremony params test): fix circuit inputs

* test(messagevalidator): fix function calls for messagevalidator circuit in tests

* chore(comments): fix unusefull comments

* refactor(poll.sol): replace external contracts with maci only

* perf(messageprocessor.sol): hardcode initialization for batchHashes array

* docs(comments): fix some more comments

* test(test for pr checks): correct some of tests for PR checks

* ci: 🎡 renamed old ProcessMessages_10-2-1-2_test

* ci: 🎡 correct rapidsnark/build/prover path

* style(reviews): solve some reviews for merging

* refactor(messageaqq): remove more message merging and message aqq

* style(messageaqq): remove more message merging and message aqq

* refactor(messageaqq): remove message aqq from subgraph

* test(coordinator): hide NOT_MERGED_MESSAGE_TREE error

* test(coordinator): fix test about message merging

* test(proveonchain): change chainHash calculation

* test(proveonchain): fix chainHashes declaration

* test(proveonchain): fix chainHash calculation

* test(proveonchain): fix chainHashes calculations

* test(proveonchain): fix chainHashes calculation

* test(proveonchain): fix loop limit

* style(review comments): resolve some of review comments

* style(review comments): resolve some of review comments

* test(lint:ts): fix e2e test because of lint:ts check

* docs(wrong changes): fix wrong changes about documentation that is not in our scope

* refactor(batchsizes): change batchSizes struct with messageBatchSize variable

* refactor(contracts): rollback to provide external contract references

* docs(messageprocessor.sol): fix typo

* refactor(messagebatchsize): chenge messageBatchSize location from Params.sol to Poll.sol

* refactor(maxmessages): remove maxMessages from maxValues

* refactor(sltimestemp): remove slTimestamp from circuits

* refactor(review comments): resolve more review comments

* fix(subgraph): fix bug about maxVoteOptions dunction call

* fix(sltimestamp): fix test for removing slTimestap signal

* refactor(promise.all): refactor promise.all for only one async call

* fix(subgraph): try to fix subgraph build

* revert(.nx folder): remove .nx folder from cli folder

* fix(merge): tmp-anon-poll-joining merge

* fix(merge): tmp-anon-poll-joining merge

* test(ceremonyparams): add poll joining in the test

* test(processmessages): add poll joining for the test

without key-change test

* test(polljoining): add poll joining in the test

* test(tallyvotes): add poll joining in the test

* test(core): add joinPoll function in tests

* style(typo): inclusion proof

* style(todo): remove finished todo

* style(merge): after merge style

* style(return): inline return

* style(eslint): remove unnecessary eslint-disable

* refactor(joiningcircuitargs): add interface IJoiningCircuitArgs

* refactor(joinpoll): async read state file

* style(genmacisignup): add function description

* refactor(gensignuptree): add IGenSignUpTreeArgs interface

* style(polljoining): remove extra inlcudes and comments

* feat(pollvkkeys): init

* feat(vkregistry): separate set functions (process/tally/poll)

* test(pollvkkey): adjust test to setPollVkKey

* refactor(vkregistry): use setVerifyingKeys in setVerifyingKeysBatch

* refactor(poll): add verifier and vkRegystry in constructor

* refactor(poll): put verifier and vkRegistry into extContracts

* test(core e2e): fix sanity checks test for incorrect signature

* refactor(test): removing only from tests

* refactor(macistatetree): use LeanIMT instead of QuinTree

* refactor(crypto): export hashLeanIMT from index

* feat(joinpoll): use genSignUpTree instead of genMaciStateFromContract

* feat(joinpoll cli): add optional parameters

* test(coordinator): add pollJoiningZkeyPath in app.test

* refactor(joinpoll): prettier

* test(coordinator): add joinPoll

* fix(poll): joiningCircuitInputs with correct siblings, indices and actualStateTreeDepth

* test(integration): add joinPoll

* build(coordinator): add COORDINATOR_POLL_ZKEY_NAME

* refactor(mergestate): remove Maci from MergeState

* test(e2e): test:e2e add joinPoll

* test(e2e): test:keyChange add joinPoll

* docs(complete documentation): complete documentation of the new workflow

* docs(documentation): add v3 docs, revert v2 docs

* style(docs): prettier

* refactor(joinpoll): add generateAndVerifyProof and getStateIndexAndCreditBalance

* docs(blogpost): blogpost cuvering the latest updates

* docs(blogpost): kudos to our team members!

* style(prettier): blog

* fix(joinpoll): index value of the user in the state tree leaves

* docs(blog): remove poll-joining




## [3.0.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.5.0...v3.0.0) (2025-03-28)


### ⚠ BREAKING CHANGES

* message processing is changed

* fix(ipoll): add missing parameter

* fix(poll-tests): add missing parameter maxMessagebatchSize

* feat(poll.ts): add chain hash updating

* test(poll tests): add test for checking chain hash computation

* feat(poll.ts): add batch hashes array computation

* feat(poll.sol): pad zeroes to the maximum size of batch

* feat(messageprocessor): update process messages to use chain hash

* refactor(vkregistry): refactor function call

* feat(processmessages.circom): add chainHash feature in circuits and test for that

* test(processmessages): rearrange test for key-change

* refactor(mergemessages): refactor functions calls which include mergemessages

* refactor(mergemessages): add some more changes about functions call which  include mergemessages

* test(all tests): fixing tests after refactoring code

* refactor(accqueue): remove all calls for accqueue

* fix(currentmessagebatchindex): fix message batch indexing

* refactor(circuit tests): refactor code for circuit testing

* test(ceremonyparams.test): correct constants for CeremonyParams test

* perf(processmessages.circom + contracts): optimize last batch padding, remove unused inputs

* docs(padlastbatch method): update doc comment

* docs(poll.ts): remove stale comments

* docs(test comments): fix typos

* ci(treedepths mock): modify interface for mocked function

* fix(ceremony params test): fix circuit inputs

* test(messagevalidator): fix function calls for messagevalidator circuit in tests

* chore(comments): fix unusefull comments

* refactor(poll.sol): replace external contracts with maci only

* perf(messageprocessor.sol): hardcode initialization for batchHashes array

* docs(comments): fix some more comments

* test(test for pr checks): correct some of tests for PR checks

* ci: 🎡 renamed old ProcessMessages_10-2-1-2_test

* ci: 🎡 correct rapidsnark/build/prover path

* style(reviews): solve some reviews for merging

* refactor(messageaqq): remove more message merging and message aqq

* style(messageaqq): remove more message merging and message aqq

* refactor(messageaqq): remove message aqq from subgraph

* test(coordinator): hide NOT_MERGED_MESSAGE_TREE error

* test(coordinator): fix test about message merging

* test(proveonchain): change chainHash calculation

* test(proveonchain): fix chainHashes declaration

* test(proveonchain): fix chainHash calculation

* test(proveonchain): fix chainHashes calculations

* test(proveonchain): fix chainHashes calculation

* test(proveonchain): fix loop limit

* style(review comments): resolve some of review comments

* style(review comments): resolve some of review comments

* test(lint:ts): fix e2e test because of lint:ts check

* docs(wrong changes): fix wrong changes about documentation that is not in our scope

* refactor(batchsizes): change batchSizes struct with messageBatchSize variable

* refactor(contracts): rollback to provide external contract references

* docs(messageprocessor.sol): fix typo

* refactor(messagebatchsize): chenge messageBatchSize location from Params.sol to Poll.sol

* refactor(maxmessages): remove maxMessages from maxValues

* refactor(sltimestemp): remove slTimestamp from circuits

* refactor(review comments): resolve more review comments

* fix(subgraph): fix bug about maxVoteOptions dunction call

* fix(sltimestamp): fix test for removing slTimestap signal

* refactor(promise.all): refactor promise.all for only one async call

* fix(subgraph): try to fix subgraph build

* revert(.nx folder): remove .nx folder from cli folder

* fix(merge): tmp-anon-poll-joining merge

* fix(merge): tmp-anon-poll-joining merge

* test(ceremonyparams): add poll joining in the test

* test(processmessages): add poll joining for the test

without key-change test

* test(polljoining): add poll joining in the test

* test(tallyvotes): add poll joining in the test

* test(core): add joinPoll function in tests

* style(typo): inclusion proof

* style(todo): remove finished todo

* style(merge): after merge style

* style(return): inline return

* style(eslint): remove unnecessary eslint-disable

* refactor(joiningcircuitargs): add interface IJoiningCircuitArgs

* refactor(joinpoll): async read state file

* style(genmacisignup): add function description

* refactor(gensignuptree): add IGenSignUpTreeArgs interface

* style(polljoining): remove extra inlcudes and comments

* feat(pollvkkeys): init

* feat(vkregistry): separate set functions (process/tally/poll)

* test(pollvkkey): adjust test to setPollVkKey

* refactor(vkregistry): use setVerifyingKeys in setVerifyingKeysBatch

* refactor(poll): add verifier and vkRegystry in constructor

* refactor(poll): put verifier and vkRegistry into extContracts

* test(core e2e): fix sanity checks test for incorrect signature

* refactor(test): removing only from tests

* refactor(macistatetree): use LeanIMT instead of QuinTree

* refactor(crypto): export hashLeanIMT from index

* feat(joinpoll): use genSignUpTree instead of genMaciStateFromContract

* feat(joinpoll cli): add optional parameters

* test(coordinator): add pollJoiningZkeyPath in app.test

* refactor(joinpoll): prettier

* test(coordinator): add joinPoll

* fix(poll): joiningCircuitInputs with correct siblings, indices and actualStateTreeDepth

* test(integration): add joinPoll

* build(coordinator): add COORDINATOR_POLL_ZKEY_NAME

* refactor(mergestate): remove Maci from MergeState

* test(e2e): test:e2e add joinPoll

* test(e2e): test:keyChange add joinPoll

* docs(complete documentation): complete documentation of the new workflow

* docs(documentation): add v3 docs, revert v2 docs

* style(docs): prettier

* refactor(joinpoll): add generateAndVerifyProof and getStateIndexAndCreditBalance

* docs(blogpost): blogpost cuvering the latest updates

* docs(blogpost): kudos to our team members!

* style(prettier): blog

* fix(joinpoll): index value of the user in the state tree leaves

* docs(blog): remove poll-joining
* message processing is changed

* fix(ipoll): add missing parameter

* fix(poll-tests): add missing parameter maxMessagebatchSize

* feat(poll.ts): add chain hash updating

* test(poll tests): add test for checking chain hash computation

* feat(poll.ts): add batch hashes array computation

* feat(poll.sol): pad zeroes to the maximum size of batch

* feat(messageprocessor): update process messages to use chain hash

* refactor(vkregistry): refactor function call

* feat(processmessages.circom): add chainHash feature in circuits and test for that

* test(processmessages): rearrange test for key-change

* refactor(mergemessages): refactor functions calls which include mergemessages

* refactor(mergemessages): add some more changes about functions call which  include mergemessages

* test(all tests): fixing tests after refactoring code

* refactor(accqueue): remove all calls for accqueue

* fix(currentmessagebatchindex): fix message batch indexing

* refactor(circuit tests): refactor code for circuit testing

* test(ceremonyparams.test): correct constants for CeremonyParams test

* perf(processmessages.circom + contracts): optimize last batch padding, remove unused inputs

* docs(padlastbatch method): update doc comment

* docs(poll.ts): remove stale comments

* docs(test comments): fix typos

* ci(treedepths mock): modify interface for mocked function

* fix(ceremony params test): fix circuit inputs

* test(messagevalidator): fix function calls for messagevalidator circuit in tests

* chore(comments): fix unusefull comments

* refactor(poll.sol): replace external contracts with maci only

* perf(messageprocessor.sol): hardcode initialization for batchHashes array

* docs(comments): fix some more comments

* test(test for pr checks): correct some of tests for PR checks

* ci: 🎡 renamed old ProcessMessages_10-2-1-2_test

* ci: 🎡 correct rapidsnark/build/prover path

* style(reviews): solve some reviews for merging

* refactor(messageaqq): remove more message merging and message aqq

* style(messageaqq): remove more message merging and message aqq

* refactor(messageaqq): remove message aqq from subgraph

* test(coordinator): hide NOT_MERGED_MESSAGE_TREE error

* test(coordinator): fix test about message merging

* test(proveonchain): change chainHash calculation

* test(proveonchain): fix chainHashes declaration

* test(proveonchain): fix chainHash calculation

* test(proveonchain): fix chainHashes calculations

* test(proveonchain): fix chainHashes calculation

* test(proveonchain): fix loop limit

* style(review comments): resolve some of review comments

* style(review comments): resolve some of review comments

* test(lint:ts): fix e2e test because of lint:ts check

* docs(wrong changes): fix wrong changes about documentation that is not in our scope

* refactor(batchsizes): change batchSizes struct with messageBatchSize variable

* refactor(contracts): rollback to provide external contract references

* docs(messageprocessor.sol): fix typo

* refactor(messagebatchsize): chenge messageBatchSize location from Params.sol to Poll.sol

* refactor(maxmessages): remove maxMessages from maxValues

* refactor(sltimestemp): remove slTimestamp from circuits

* refactor(review comments): resolve more review comments

* fix(subgraph): fix bug about maxVoteOptions dunction call

* fix(sltimestamp): fix test for removing slTimestap signal

* refactor(promise.all): refactor promise.all for only one async call

* fix(subgraph): try to fix subgraph build

* revert(.nx folder): remove .nx folder from cli folder

### Features

* add number of valid vote options ([cdba5a3](https://github.com/privacy-scaling-explorations/maci/commit/cdba5a3ca939fab8e51e40b734bd2061a87daa37))
* add start and end timestmap for poll ([cf67b53](https://github.com/privacy-scaling-explorations/maci/commit/cf67b539d7d5dfd8b83ba3e0becaa20d0292b410))
* anonymous poll joining milestone 1 ([#1625](https://github.com/privacy-scaling-explorations/maci/issues/1625)) ([5566cfe](https://github.com/privacy-scaling-explorations/maci/commit/5566cfece1ed989ececdaad07edb2fc3a0b4741a))
* anonymous poll joining milestone 2 and 3 ([#1750](https://github.com/privacy-scaling-explorations/maci/issues/1750)) ([47d6937](https://github.com/privacy-scaling-explorations/maci/commit/47d69371113f2b0f07cc9f60208e0601a4f9a065))
* rebase anon poll joining with dev ([c384a5b](https://github.com/privacy-scaling-explorations/maci/commit/c384a5b8e53706bb00060f684242e8ba9a4d11e8))
* **sdk:** add relayer functions ([6273ef8](https://github.com/privacy-scaling-explorations/maci/commit/6273ef8c07675aaebe6d1d73d2c1e51de1ccfc56))
* **subgraph:** add chain hashes and ipfs messages to subgraph ([cb139ea](https://github.com/privacy-scaling-explorations/maci/commit/cb139ead7007303d18c0151638ca79203a0c5fed))
* voice credits per poll ([#1967](https://github.com/privacy-scaling-explorations/maci/issues/1967)) ([f59e9c3](https://github.com/privacy-scaling-explorations/maci/commit/f59e9c350133efb2fbbc37e5139addf5e34c55e6))


### Bug Fixes

* add missing parts after anon poll joining rebase ([6349806](https://github.com/privacy-scaling-explorations/maci/commit/63498069fce87dd615d5be1db84a69332fcefe6e))


### Miscellaneous

* **deps-dev:** bump wabt from 1.0.36 to 1.0.37 ([5611907](https://github.com/privacy-scaling-explorations/maci/commit/561190791f5fffc7644b9f6be56967ab0706f958))
* **deps:** bump @graphprotocol/graph-cli from 0.88.0 to 0.95.0 ([#2069](https://github.com/privacy-scaling-explorations/maci/issues/2069)) ([46da711](https://github.com/privacy-scaling-explorations/maci/commit/46da7116b77dbd416b55592664b9a25abdb2e5b1))
* **deps:** bump @graphprotocol/graph-cli from 0.95.0 to 0.96.0 ([aa88b9a](https://github.com/privacy-scaling-explorations/maci/commit/aa88b9a6f8608208aa8ac2ba62d21449f509df29))
* **deps:** bump @graphprotocol/graph-ts from 0.35.1 to 0.37.0 ([c355be3](https://github.com/privacy-scaling-explorations/maci/commit/c355be3072d80f31645ac78702f8fc1f29c572ba))
* **deps:** bump @graphprotocol/graph-ts from 0.37.0 to 0.38.0 ([8057e4a](https://github.com/privacy-scaling-explorations/maci/commit/8057e4a5b3570fb747ba90111cbfdd1338c36c01))



## [2.5.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.4.0...v2.5.0) (2024-11-20)


### Miscellaneous

* **deps:** bump @graphprotocol/graph-cli from 0.80.0 to 0.88.0 ([a8124ae](https://github.com/privacy-scaling-explorations/maci/commit/a8124aede8850d61cbf927399582ef7bc31f5eba))



## [2.4.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.3.0...v2.4.0) (2024-09-30)

**Note:** Version bump only for package maci-subgraph





## [2.3.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.2.1...v2.3.0) (2024-09-05)

**Note:** Version bump only for package maci-subgraph





## [2.2.1](https://github.com/privacy-scaling-explorations/maci/compare/v2.2.0...v2.2.1) (2024-08-19)

**Note:** Version bump only for package maci-subgraph





## [2.2.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.1.0...v2.2.0) (2024-08-19)

**Note:** Version bump only for package maci-subgraph





## [2.1.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.0.0...v2.1.0) (2024-08-07)

**Note:** Version bump only for package maci-subgraph





## [2.0.0](https://github.com/privacy-scaling-explorations/maci/compare/v1.2.0...v2.0.0) (2024-08-06)


### Features

* **coordinator:** deploy subgraph from coordinator service ([d04d82c](https://github.com/privacy-scaling-explorations/maci/commit/d04d82cb4a3e022471726f87b24b2ee14b8ae0a2))
* export merge function and modify package version ([#1584](https://github.com/privacy-scaling-explorations/maci/issues/1584)) ([f6ae34a](https://github.com/privacy-scaling-explorations/maci/commit/f6ae34a3f9ea375cd5dac8f0ce8618e33509f8ad))
* **subgraph:** add maci-subgraph package ([724ee0c](https://github.com/privacy-scaling-explorations/maci/commit/724ee0c42411d7e95236a6b1bf95d58805b14e81))
* **subgraph:** optimize subgraph schema ([44094f4](https://github.com/privacy-scaling-explorations/maci/commit/44094f4b0d3e250786b1a21e4f0f2daa596167f1))
* **subgraph:** optimize subgraph schema (maci) ([#1564](https://github.com/privacy-scaling-explorations/maci/issues/1564)) ([ceebd3a](https://github.com/privacy-scaling-explorations/maci/commit/ceebd3a98424267fa92fedd7b7cd336416bdecb1))
* **subgraph:** store poll mode on subgraph ([#1620](https://github.com/privacy-scaling-explorations/maci/issues/1620)) ([29c53dc](https://github.com/privacy-scaling-explorations/maci/commit/29c53dc694b204d1e08967cb8ca8b1719fa79bae))


### Bug Fixes

* **subgraph:** add version and files for package.json ([3c00473](https://github.com/privacy-scaling-explorations/maci/commit/3c0047301ae729586ec020f41c0ab0f9ea347f22))
* **subgraph:** remove user-polls relation ([70a316e](https://github.com/privacy-scaling-explorations/maci/commit/70a316e4b1d3d2a3b7dea34b923db12ff7141be4))


### Code Refactoring

* **contracts:** do not return contract addresses on poll deploy ([43d5224](https://github.com/privacy-scaling-explorations/maci/commit/43d52240755a3371ff0f7e0454e6a0dad80ddce4))


### Miscellaneous

* **config:** added scroll to config and fixed broken links ([#1565](https://github.com/privacy-scaling-explorations/maci/issues/1565)) ([507e60a](https://github.com/privacy-scaling-explorations/maci/commit/507e60a366a36b5238d52a4ff70c397f4a3fc74e))
* **deps-dev:** bump wabt from 1.0.35 to 1.0.36 ([75541a8](https://github.com/privacy-scaling-explorations/maci/commit/75541a8589067c6a0bb5e2586b578693a68a043c))
* **deps:** bump @graphprotocol/graph-cli from 0.73.0 to 0.74.1 ([2ec7d08](https://github.com/privacy-scaling-explorations/maci/commit/2ec7d084fcbf5d042c3c1388cc2d7c28b2ddeb1c))
* **deps:** bump @graphprotocol/graph-cli from 0.74.1 to 0.76.0 ([#1593](https://github.com/privacy-scaling-explorations/maci/issues/1593)) ([1dc9e65](https://github.com/privacy-scaling-explorations/maci/commit/1dc9e65e90fc0214e6cb84539697a949f1735079))
* **deps:** bump @graphprotocol/graph-cli from 0.76.0 to 0.78.0 ([5cff3ee](https://github.com/privacy-scaling-explorations/maci/commit/5cff3eebae70a57559e30df30f6404ae638c2f50))
* **deps:** bump @graphprotocol/graph-cli from 0.78.0 to 0.79.0 ([ee5b4e5](https://github.com/privacy-scaling-explorations/maci/commit/ee5b4e591c324d503166e60294e8cae7ab53ac56))
* **deps:** bump @graphprotocol/graph-cli from 0.79.0 to 0.80.0 ([3ddfe26](https://github.com/privacy-scaling-explorations/maci/commit/3ddfe26a0c1ad557c35da382ccd6f5cbe207c4f6))
* **release:** publish 2.0.0 ([04e647d](https://github.com/privacy-scaling-explorations/maci/commit/04e647d231df34952569ad6ff802e0b2333eb658))
* remove max values ([8f951b0](https://github.com/privacy-scaling-explorations/maci/commit/8f951b0fcc73212d99d3ddc962fbaa9788471fb6))
* **subgraph:** configure maci-subgraph to be a public npm package ([#1712](https://github.com/privacy-scaling-explorations/maci/issues/1712)) ([03f7713](https://github.com/privacy-scaling-explorations/maci/commit/03f7713a7a534e24584796cdfcc132adc739aad6))
