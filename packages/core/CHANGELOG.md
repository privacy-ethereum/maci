# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

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
* anonymous poll joining milestone 1 ([#1625](https://github.com/privacy-scaling-explorations/maci/issues/1625)) ([5566cfe](https://github.com/privacy-scaling-explorations/maci/commit/5566cfece1ed989ececdaad07edb2fc3a0b4741a))
* anonymous poll joining milestone 2 and 3 ([#1750](https://github.com/privacy-scaling-explorations/maci/issues/1750)) ([47d6937](https://github.com/privacy-scaling-explorations/maci/commit/47d69371113f2b0f07cc9f60208e0601a4f9a065))
* **circuits:** add poll joined circuit ([30c4f6a](https://github.com/privacy-scaling-explorations/maci/commit/30c4f6a6edbbe8f2a9685e3bb40b9eaa5e893d84))
* force the same key for each poll ([#2063](https://github.com/privacy-scaling-explorations/maci/issues/2063)) ([11e5b8a](https://github.com/privacy-scaling-explorations/maci/commit/11e5b8aa577a88aa1dcf5c745dab900352da351d))
* make nullifier not leak identity between polls ([#1974](https://github.com/privacy-scaling-explorations/maci/issues/1974)) ([c9e7efc](https://github.com/privacy-scaling-explorations/maci/commit/c9e7efc825be2d0aaabae014ae51a97e2adaa413))
* rebase anon poll joining with dev ([c384a5b](https://github.com/privacy-scaling-explorations/maci/commit/c384a5b8e53706bb00060f684242e8ba9a4d11e8))
* **relayer:** add auth guard for message publishing ([813bfc7](https://github.com/privacy-scaling-explorations/maci/commit/813bfc7b25e403902e6779ef4304ee48bb5640e9))
* voice credits per poll ([#1967](https://github.com/privacy-scaling-explorations/maci/issues/1967)) ([f59e9c3](https://github.com/privacy-scaling-explorations/maci/commit/f59e9c350133efb2fbbc37e5139addf5e34c55e6))


### Bug Fixes

* anon poll joining ([bc6d4c2](https://github.com/privacy-scaling-explorations/maci/commit/bc6d4c28ce19d7d84d86fb6c96ca6a5f26780558))
* remove max vote options param ([765ca42](https://github.com/privacy-scaling-explorations/maci/commit/765ca42d391afc8026895d0e4d269b71435c3f73))


### Code Refactoring

* remove redundant param ([#2161](https://github.com/privacy-scaling-explorations/maci/issues/2161)) ([2cc986f](https://github.com/privacy-scaling-explorations/maci/commit/2cc986fadd91283cd78f3f90bc8825d2aa44e2a5))


### Miscellaneous

* **deps-dev:** bump @types/mocha from 10.0.8 to 10.0.10 ([a8b029a](https://github.com/privacy-scaling-explorations/maci/commit/a8b029a140b3bc81c639c26e049a766ce67b8886))
* **deps-dev:** bump @types/node from 20.17.19 to 22.13.9 ([aa7c356](https://github.com/privacy-scaling-explorations/maci/commit/aa7c356469592547f3d60c05077268267d7ea186))
* **deps-dev:** bump @types/node from 22.10.7 to 22.12.0 ([#2073](https://github.com/privacy-scaling-explorations/maci/issues/2073)) ([1dcb28e](https://github.com/privacy-scaling-explorations/maci/commit/1dcb28e33699ee91f9691c1073d4da0293e406c0))
* **deps-dev:** bump @types/node from 22.12.0 to 22.13.1 ([5f06af0](https://github.com/privacy-scaling-explorations/maci/commit/5f06af0180f522f552519529c07d2bb660fdd586))
* **deps-dev:** bump @types/node from 22.13.1 to 22.13.4 ([dba94f4](https://github.com/privacy-scaling-explorations/maci/commit/dba94f4fe6d405eaca655dfdc8ca01d57664b99b))
* **deps-dev:** bump @types/node from 22.13.9 to 22.13.10 ([#2241](https://github.com/privacy-scaling-explorations/maci/issues/2241)) ([3f50bb6](https://github.com/privacy-scaling-explorations/maci/commit/3f50bb65db4cd83b5ebe9d4fb1b7a6d650bb1c51))
* **deps-dev:** bump @types/node from 22.9.0 to 22.10.7 ([3e4a5ae](https://github.com/privacy-scaling-explorations/maci/commit/3e4a5ae43cc57d6ebaedeb5ce95ca6dd1c968ffe))
* **deps-dev:** bump mocha from 10.7.3 to 11.0.1 ([457a504](https://github.com/privacy-scaling-explorations/maci/commit/457a5048580a5460ad012b10486a65df0dacae0e))
* **deps-dev:** bump mocha from 10.8.2 to 11.1.0 ([f524a07](https://github.com/privacy-scaling-explorations/maci/commit/f524a07f5a3b1e94eaf6f230ecf16476f4c6810d))
* **deps-dev:** bump ts-mocha from 10.0.0 to 11.1.0 ([df84193](https://github.com/privacy-scaling-explorations/maci/commit/df84193a1ad0980523aba66f5b43b5a6cdd74307))
* **deps-dev:** bump typescript and typedoc ([4ee5de5](https://github.com/privacy-scaling-explorations/maci/commit/4ee5de5e29c6326b6728dc2ccd97da3bdea42fd7))
* **deps-dev:** bump typescript from 5.7.3 to 5.8.2 ([e37f1bf](https://github.com/privacy-scaling-explorations/maci/commit/e37f1bffd8193de316e748d0406cfb606455cb46))
* **deps:** bump @zk-kit/lean-imt from 2.2.1 to 2.2.2 ([73fddce](https://github.com/privacy-scaling-explorations/maci/commit/73fddced5d2d008526b8fc027208649368742e56))
* **deps:** bump @zk-kit/lean-imt from 2.2.2 to 2.2.3 ([a269d5c](https://github.com/privacy-scaling-explorations/maci/commit/a269d5ce4e47145e02a58b30c793672ab43a9c30))
* fix 404 status URL ([#1949](https://github.com/privacy-scaling-explorations/maci/issues/1949)) ([38cbf66](https://github.com/privacy-scaling-explorations/maci/commit/38cbf66dcc7f51e98a0167db23ed3128eba44222))
* **relayer:** add more e2e tests ([0cbfc40](https://github.com/privacy-scaling-explorations/maci/commit/0cbfc40b2915924cdc6b6fc7db4392868f6f8845))
* update zkeys link ([1c8fa1b](https://github.com/privacy-scaling-explorations/maci/commit/1c8fa1b922929a3753f7e6ff92aa6806a7998048))



## [2.5.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.4.0...v2.5.0) (2024-11-20)


### Miscellaneous

* **deps-dev:** bump @types/node from 22.4.1 to 22.8.1 ([#1873](https://github.com/privacy-scaling-explorations/maci/issues/1873)) ([c1b9c0e](https://github.com/privacy-scaling-explorations/maci/commit/c1b9c0ed18eb3fae5e189dff952a8ab9dfb2f9b1))
* **deps-dev:** bump @types/node from 22.8.1 to 22.9.0 ([0e11e5d](https://github.com/privacy-scaling-explorations/maci/commit/0e11e5d668fed2e2168de56e87981b0edcca8cd9))
* **deps-dev:** bump nyc from 17.0.0 to 17.1.0 ([3dce47c](https://github.com/privacy-scaling-explorations/maci/commit/3dce47c8c2a016765ae68b48ebd38b36226b9709))
* **deps-dev:** bump typescript from 5.5.4 to 5.6.3 ([8058c5d](https://github.com/privacy-scaling-explorations/maci/commit/8058c5de1d865317c79a00508b672091cd7b1eb0))



## [2.4.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.3.0...v2.4.0) (2024-09-30)


### Miscellaneous

* **deps-dev:** bump @types/mocha from 10.0.7 to 10.0.8 ([#1827](https://github.com/privacy-scaling-explorations/maci/issues/1827)) ([4deae8b](https://github.com/privacy-scaling-explorations/maci/commit/4deae8bb3a4ea5cf1b4ad16018186a593142adb8))



## [2.2.0](https://github.com/privacy-scaling-explorations/maci/compare/v2.1.0...v2.2.0) (2024-08-19)


### Miscellaneous

* **deps-dev:** bump @types/node from 22.1.0 to 22.2.0 ([ac18985](https://github.com/privacy-scaling-explorations/maci/commit/ac189852bf6abb787736c474ad87927afaa5163c))
* **deps-dev:** bump @types/node from 22.2.0 to 22.4.1 ([#1779](https://github.com/privacy-scaling-explorations/maci/issues/1779)) ([4a929e0](https://github.com/privacy-scaling-explorations/maci/commit/4a929e0b9a5c4de5ac0345e742668a3400798867))
* **deps-dev:** bump mocha from 10.7.0 to 10.7.3 ([6ba908f](https://github.com/privacy-scaling-explorations/maci/commit/6ba908f5f78628aa6afe973b3d71ae54ff08c735))



## [2.0.0](https://github.com/privacy-scaling-explorations/maci/compare/v1.2.0...v2.0.0) (2024-08-06)


### ⚠ BREAKING CHANGES

* **topup:** No more topups

### Features

* export merge function and modify package version ([#1584](https://github.com/privacy-scaling-explorations/maci/issues/1584)) ([f6ae34a](https://github.com/privacy-scaling-explorations/maci/commit/f6ae34a3f9ea375cd5dac8f0ce8618e33509f8ad))
* **multiple-polls:** allow concurrent polls ([14e89ba](https://github.com/privacy-scaling-explorations/maci/commit/14e89baea1ede9bc9bad79fafb5c362d6a6a81e9))


### Bug Fixes

* add coordinator public key hash public input ([9766bbf](https://github.com/privacy-scaling-explorations/maci/commit/9766bbfcecd41bd0f39c1422978d959705b1b500))
* **core:** add typescript dev dependency to fix build ([a95896b](https://github.com/privacy-scaling-explorations/maci/commit/a95896b682f55a2eb891db0f5b901a847681438c))


### Code Refactoring

* enhance MACI circuits readability  ([#1337](https://github.com/privacy-scaling-explorations/maci/issues/1337)) ([3770a2a](https://github.com/privacy-scaling-explorations/maci/commit/3770a2ab6626c4beffb71e7b2d9dce595e5e9f53))
* **maci:** remove subsidy feature to simplify further protocol improvements ([52fc7c5](https://github.com/privacy-scaling-explorations/maci/commit/52fc7c5b8f2d389868bca6171ffd15a94b1d1659))
* **topup:** remove the topup feature ([67711d4](https://github.com/privacy-scaling-explorations/maci/commit/67711d44058831302d4556f12d1972ffacede653))


### Miscellaneous

* bump to 1.2.2 ([e63278f](https://github.com/privacy-scaling-explorations/maci/commit/e63278f71937a1fa908ec8f4be2d43114701c134))
* **contracts:** add typedoc script for contracts package ([43459a0](https://github.com/privacy-scaling-explorations/maci/commit/43459a02301f102e80a709a0a722dd591e8e00ef))
* **core:** do not print warning on failed decryption of message 0 ([97cb6af](https://github.com/privacy-scaling-explorations/maci/commit/97cb6af325845f0d0f54b4eb66092021729fa24f))
* **deps-dev:** bump @types/mocha from 10.0.6 to 10.0.7 ([07c3480](https://github.com/privacy-scaling-explorations/maci/commit/07c3480efc40ad1d3f651b78cd7c3aaeee8d7f8a))
* **deps-dev:** bump @types/node from 20.11.20 to 20.11.24 ([c575eca](https://github.com/privacy-scaling-explorations/maci/commit/c575eca7c54c262764ce794a919f3b1d58d7d8e7))
* **deps-dev:** bump @types/node from 20.11.24 to 20.11.25 ([5eb49f9](https://github.com/privacy-scaling-explorations/maci/commit/5eb49f9090fc6db3a80ad2d63548d93430ff7645))
* **deps-dev:** bump @types/node from 20.11.25 to 20.11.28 ([81bebaa](https://github.com/privacy-scaling-explorations/maci/commit/81bebaa880cbc15b8c8445d412b9fc9d89580e67))
* **deps-dev:** bump @types/node from 20.11.28 to 20.11.30 ([5ef4420](https://github.com/privacy-scaling-explorations/maci/commit/5ef44209d16cd441067fb67201daa61cf968382d))
* **deps-dev:** bump @types/node from 20.11.30 to 20.12.2 ([e7c32d0](https://github.com/privacy-scaling-explorations/maci/commit/e7c32d0ddd506727f229d950239a116961bbe1a0))
* **deps-dev:** bump @types/node from 20.12.10 to 20.12.11 ([3019c66](https://github.com/privacy-scaling-explorations/maci/commit/3019c66eb70e54b376e9464417e073bd98d96b6a))
* **deps-dev:** bump @types/node from 20.12.11 to 20.12.12 ([bd0a0a5](https://github.com/privacy-scaling-explorations/maci/commit/bd0a0a5a1ec685542c2af4f6962186176d5453ba))
* **deps-dev:** bump @types/node from 20.12.2 to 20.12.5 ([588392f](https://github.com/privacy-scaling-explorations/maci/commit/588392f2f773addce0204f236fc26981ead1f7bb))
* **deps-dev:** bump @types/node from 20.12.5 to 20.12.7 ([f1b00de](https://github.com/privacy-scaling-explorations/maci/commit/f1b00deb29788e390dcecd5b1741339f96f06f73))
* **deps-dev:** bump @types/node from 20.12.7 to 20.12.10 ([cf5026a](https://github.com/privacy-scaling-explorations/maci/commit/cf5026a42a41c0078467fb477fdd51a2afb31e1f))
* **deps-dev:** bump @types/node from 20.14.10 to 20.14.11 ([01564c0](https://github.com/privacy-scaling-explorations/maci/commit/01564c0503379ca65ce90ea77fdc5ebcd9ae81c5))
* **deps-dev:** bump @types/node from 20.14.11 to 22.1.0 ([#1732](https://github.com/privacy-scaling-explorations/maci/issues/1732)) ([3c4b9d9](https://github.com/privacy-scaling-explorations/maci/commit/3c4b9d9c9eb7439c4ea9791e4388ff586530be50))
* **deps-dev:** bump @types/node from 20.14.2 to 20.14.8 ([636ac22](https://github.com/privacy-scaling-explorations/maci/commit/636ac22bd29d12e5af7f69c7dd639d0223595992))
* **deps-dev:** bump @types/node from 20.14.8 to 20.14.10 ([add0ce4](https://github.com/privacy-scaling-explorations/maci/commit/add0ce4e406fea4bfe2b839facc6a0a33b3fe3bf))
* **deps-dev:** bump mocha from 10.3.0 to 10.4.0 ([7bf5afe](https://github.com/privacy-scaling-explorations/maci/commit/7bf5afe954bcb6b34dbe7f109c9c7e8d5396f1b2))
* **deps-dev:** bump mocha from 10.4.0 to 10.5.0 ([e5c14cf](https://github.com/privacy-scaling-explorations/maci/commit/e5c14cf01e9b5beb6232e80345121dbb47190fd0))
* **deps-dev:** bump mocha from 10.5.0 to 10.6.0 ([6847bb3](https://github.com/privacy-scaling-explorations/maci/commit/6847bb374893672bf7e809fc80d124e2d874b784))
* **deps-dev:** bump mocha from 10.6.0 to 10.7.0 ([#1687](https://github.com/privacy-scaling-explorations/maci/issues/1687)) ([2cad35b](https://github.com/privacy-scaling-explorations/maci/commit/2cad35bab133af79f77ea9c19098d3561ba06f69))
* **deps-dev:** bump nyc from 15.1.0 to 17.0.0 ([c7f4414](https://github.com/privacy-scaling-explorations/maci/commit/c7f441417d7c7ec8019867801b77e7b5c07c2307))
* **deps-dev:** bump typescript from 5.4.2 to 5.4.3 ([a2f5c8a](https://github.com/privacy-scaling-explorations/maci/commit/a2f5c8ac32394fc7672051d5342baf7e6f9567ce))
* **deps-dev:** bump typescript from 5.4.3 to 5.4.4 ([5e047ea](https://github.com/privacy-scaling-explorations/maci/commit/5e047eaa96d508addf34e35764ddaf4deb221593))
* **deps-dev:** bump typescript from 5.4.4 to 5.4.5 ([ea6339d](https://github.com/privacy-scaling-explorations/maci/commit/ea6339da96dda38a931cb6d39615c9267ca45b81))
* **deps-dev:** bump typescript from 5.4.5 to 5.5.2 ([e2b4d45](https://github.com/privacy-scaling-explorations/maci/commit/e2b4d45235c82bba349d959a164442cae90ad97f))
* **deps-dev:** bump typescript from 5.5.2 to 5.5.3 ([c979188](https://github.com/privacy-scaling-explorations/maci/commit/c979188358becfc4b434a2f73331e640ce595846))
* **deps-dev:** bump typescript from 5.5.3 to 5.5.4 ([8ed2e2b](https://github.com/privacy-scaling-explorations/maci/commit/8ed2e2b109a950137dd289aa7d3eca4268079272))
* fix typos ([96ae030](https://github.com/privacy-scaling-explorations/maci/commit/96ae030bfe10b0fb94e1304cd017f8775cd58b1d))
* optimize message processor and tally ([d75b244](https://github.com/privacy-scaling-explorations/maci/commit/d75b2446c2ee012d146afe8d7bc423f5b94e4579))
* **poll:** cleanup tests ([#938](https://github.com/privacy-scaling-explorations/maci/issues/938)) ([4fbb91a](https://github.com/privacy-scaling-explorations/maci/commit/4fbb91a66a8812902fca7b2029d24657aaff8b86))
* **release:** publish 1.2.1 ([93564f8](https://github.com/privacy-scaling-explorations/maci/commit/93564f8a98baa0fee65db16e2e40209d9ac1b3ae))
* **release:** publish 2.0.0 ([04e647d](https://github.com/privacy-scaling-explorations/maci/commit/04e647d231df34952569ad6ff802e0b2333eb658))
* remove max values ([8f951b0](https://github.com/privacy-scaling-explorations/maci/commit/8f951b0fcc73212d99d3ddc962fbaa9788471fb6))
* remove repetitive words ([75d2410](https://github.com/privacy-scaling-explorations/maci/commit/75d2410106dec71ffca744404c8b5a201217435f))



## [1.2.0](https://github.com/privacy-scaling-explorations/maci/compare/v1.1.1...v1.2.0) (2024-02-23)


### Features

* **qv:** add optional flag to use quadratic voting or not in MACI ([86ba854](https://github.com/privacy-scaling-explorations/maci/commit/86ba8548780049245482e5277cc47f4a8776e9e6))
* update sidebar ([6206a1b](https://github.com/privacy-scaling-explorations/maci/commit/6206a1b8849108d78997e00b01c6e7f11efce124))


### Bug Fixes

* **circuits:** enforce use of stateIndex from message ([510e6ee](https://github.com/privacy-scaling-explorations/maci/commit/510e6ee365958e8c7f72cfca6cea75d15a89d28b))
* **circuits:** fix coordinator censoring by passing currentVoteWeight = 0 ([22e091d](https://github.com/privacy-scaling-explorations/maci/commit/22e091d2941b5e86ecd7df2f228bd0e10b6c4c47))
* **contracts:** save numSignups after merging maciStateAq inside the Poll contract ([4985b2d](https://github.com/privacy-scaling-explorations/maci/commit/4985b2d61655f3b802186fc03c2d85a658c0f0da)), closes [#1091](https://github.com/privacy-scaling-explorations/maci/issues/1091)
* **publish:** ensure we publish the correct files ([bc42724](https://github.com/privacy-scaling-explorations/maci/commit/bc42724b34cf0c047c5692fbf477ed013a102aee))
* **publishing:** do not publish benchmarks folder ([f2fbc36](https://github.com/privacy-scaling-explorations/maci/commit/f2fbc368a8a9520288b365e6fdf04fd3fee9e685))
* **signups:** ensure we account for the blank state leaf ([b1c8c97](https://github.com/privacy-scaling-explorations/maci/commit/b1c8c9719da5d47b92408f1222399c9c4acf3df9)), closes [#947](https://github.com/privacy-scaling-explorations/maci/issues/947)
* **topup:** check valid new state leaf balance ([ec12d2b](https://github.com/privacy-scaling-explorations/maci/commit/ec12d2b1ec31b0607f65be49a5679fcae5e3939d))


### Code Refactoring

* **contracts:** add natspec across contracts and cleanup ([a6ad25e](https://github.com/privacy-scaling-explorations/maci/commit/a6ad25e3787fee837172b95ee706951806131bd4))
* **core:** cleanup the core package and ensure every function has a proper type ([f277e48](https://github.com/privacy-scaling-explorations/maci/commit/f277e48c040148f741e7a8cd8dbea9e6bf4ea1cc))
* **core:** export `TestHarness` from core test utils ([f8d4ccb](https://github.com/privacy-scaling-explorations/maci/commit/f8d4ccb3b70c006bb4aa59d67e5528f7bbf91d8e))
* **core:** refactor the core package subsidy and tally functions ([0af7dd2](https://github.com/privacy-scaling-explorations/maci/commit/0af7dd2d448c4796c3872665d43654343f9fc3e3))
* **core:** refactor the process message functions and general cleanup ([823cacd](https://github.com/privacy-scaling-explorations/maci/commit/823cacd8659281b8390b74c8d765b23ee7a83a80))
* **core:** remove redundant code which could slow down processing ([5a6fe98](https://github.com/privacy-scaling-explorations/maci/commit/5a6fe987a8e648abbcfd7ce2d768e216c19231a3))
* **core:** remove unnecessary messageAq from Poll ([d3930f7](https://github.com/privacy-scaling-explorations/maci/commit/d3930f706963747903305cce1ee5a716ea28c31d))
* **core:** remove unnecessary stateAq from MaciState ([22a4f28](https://github.com/privacy-scaling-explorations/maci/commit/22a4f286010ff5add413eee88d933c0e74898346))
* **core:** update README.md ([11ba386](https://github.com/privacy-scaling-explorations/maci/commit/11ba386a37cc802c4fd6a3c243e493de8e04a339))
* **crypto:** remove ffjavascript and implement utils functions locally ([0b2986f](https://github.com/privacy-scaling-explorations/maci/commit/0b2986fcaadbfce37ff9fc0007ddeae97573924e)), closes [#458](https://github.com/privacy-scaling-explorations/maci/issues/458)
* fix ESLint issues ([6c0ed97](https://github.com/privacy-scaling-explorations/maci/commit/6c0ed97c0976a81b5e5506699d550ec93a553cb8))
* **maci-core:** refactor directory structure for quick core component access ([3aeba77](https://github.com/privacy-scaling-explorations/maci/commit/3aeba77435fbd783e5cecf88a1f2c0d4c58c8022))
* **nonqv:** optimize tally votes non qv circuit and contracts ([ea632a9](https://github.com/privacy-scaling-explorations/maci/commit/ea632a97862c4304c764f511ab480b3664224b5f))
* **optimisedmt:** remove dependency and implement locally ([c7d81e2](https://github.com/privacy-scaling-explorations/maci/commit/c7d81e20aaf6308c7d4e1efc09c497729f6a8f10))
* **repo:** remove redundant code from certain packages ([d55497a](https://github.com/privacy-scaling-explorations/maci/commit/d55497a9805812b2d2472386caecf75995d6efcf))
* **zk-kit-poseidon:** remove old circomlib dependencies in crypto ([0340f79](https://github.com/privacy-scaling-explorations/maci/commit/0340f7960a2214410d8885541ac542419a980a34))


### Miscellaneous

* add a badges to README.md ([888524b](https://github.com/privacy-scaling-explorations/maci/commit/888524baae82d56edbf0c794e587de174906c34c))
* add types check ([69f038f](https://github.com/privacy-scaling-explorations/maci/commit/69f038f55e6c740d43b8b5376db999bcf92de845))
* apply prettier ([8b905c0](https://github.com/privacy-scaling-explorations/maci/commit/8b905c0948d4a1f950653c6812067ec98ebfcbc8))
* bundle size optimizations ([18da49c](https://github.com/privacy-scaling-explorations/maci/commit/18da49c791e53350158659df8248d48af8e80f6d))
* **changelog:** add CHANGELOG of v1.1.1 ([f0c315a](https://github.com/privacy-scaling-explorations/maci/commit/f0c315a4c1b86f88839f2dbe4c4b9f59193f7be4))
* **cli:** integrate linter ([49571a1](https://github.com/privacy-scaling-explorations/maci/commit/49571a1199a8a027c64a7c39bd21f46a3a268f43))
* **cli:** optimize bundle size ([39268b2](https://github.com/privacy-scaling-explorations/maci/commit/39268b2ff8e0d27d062c6d3bc52a63ce8038ec5e))
* **contract:** apply linter for deploy scripts and contracts ([9af9c04](https://github.com/privacy-scaling-explorations/maci/commit/9af9c0497a2491eaf89fbff475cf0f60bc04f59c))
* **core:** add `CircuitInputs` type ([c4b72b0](https://github.com/privacy-scaling-explorations/maci/commit/c4b72b0f0b25a1bb147348a728a9550c8b6460a1))
* **core:** add quiet flag to process messages to log errors ([8793a09](https://github.com/privacy-scaling-explorations/maci/commit/8793a09dd3c52021d467b27e1cb64c023faba317)), closes [#1135](https://github.com/privacy-scaling-explorations/maci/issues/1135)
* **core:** add Typedoc comments ([a8521ee](https://github.com/privacy-scaling-explorations/maci/commit/a8521eea97bca47298bc2c59ae1c31df9533258b))
* **core:** add unit tests for the process messages functions of the core package ([c78e1b4](https://github.com/privacy-scaling-explorations/maci/commit/c78e1b4c4a7acea9e18beef7291c8258b7b08c65))
* **core:** integrate linter ([614e76b](https://github.com/privacy-scaling-explorations/maci/commit/614e76b1b1de5d2c9876b11f15439e92b86db8f6))
* **core:** process messages test ([3db370e](https://github.com/privacy-scaling-explorations/maci/commit/3db370ef876213b1cefce39fb98b00640d9750e9))
* **core:** publish a declaration file ([0b55568](https://github.com/privacy-scaling-explorations/maci/commit/0b55568ee41dc9191b342dab057feccd1745b5fd))
* **core:** refactor and add tests for the core package ([4aedb83](https://github.com/privacy-scaling-explorations/maci/commit/4aedb83c917c0590f88a982a4b2eb910a2aab893))
* **core:** remove unnecessary code ([5f6d6b5](https://github.com/privacy-scaling-explorations/maci/commit/5f6d6b507665c64a7f6b0c81b0fc2475bc073984))
* **core:** replace repeated chaining call ([0588ef6](https://github.com/privacy-scaling-explorations/maci/commit/0588ef649420b850c9fe6f115dc5431016b741fb))
* **coverage:** setup coverage for TS packages ([f4e6964](https://github.com/privacy-scaling-explorations/maci/commit/f4e6964b3e268e4d3f2819b85e6abf3e34bcb10e))
* **crypto:** add type export for path elements ([35866fb](https://github.com/privacy-scaling-explorations/maci/commit/35866fb0f086b18835b74e5ecdb55aaceb3ef8db))
* **dependencies:** update project dependencies and remove redundant ones ([4c5ac27](https://github.com/privacy-scaling-explorations/maci/commit/4c5ac27767492c9867a6e2ab2acd6b10fe132847))
* **deps-dev:** bump @types/node from 18.19.6 to 20.10.8 ([6645120](https://github.com/privacy-scaling-explorations/maci/commit/664512038212d36d40799e8c4787847735bd7d82))
* **deps-dev:** bump @types/node from 20.10.8 to 20.11.0 ([805d253](https://github.com/privacy-scaling-explorations/maci/commit/805d2536a54478c51403362419ecad0b6ab736a7))
* **deps-dev:** bump @types/node from 20.11.0 to 20.11.2 ([45839e8](https://github.com/privacy-scaling-explorations/maci/commit/45839e8c2668ec56ea06221758605f88029ea8a1))
* **deps-dev:** bump @types/node from 20.11.10 to 20.11.16 ([8144919](https://github.com/privacy-scaling-explorations/maci/commit/8144919939f7d9a841eb6fce7182628cedbf8746))
* **deps-dev:** bump @types/node from 20.11.16 to 20.11.17 ([44de5db](https://github.com/privacy-scaling-explorations/maci/commit/44de5db0c25a5fdfd5c13c397f49edb7185bf1f5))
* **deps-dev:** bump @types/node from 20.11.17 to 20.11.19 ([8d86b32](https://github.com/privacy-scaling-explorations/maci/commit/8d86b32ef70b89f4239aad3903fd36937cf6a90f))
* **deps-dev:** bump @types/node from 20.11.2 to 20.11.5 ([7698ede](https://github.com/privacy-scaling-explorations/maci/commit/7698edef2b95bc017e54c1fc0d796ccc9da3de85))
* **deps-dev:** bump @types/node from 20.11.5 to 20.11.10 ([a2c445a](https://github.com/privacy-scaling-explorations/maci/commit/a2c445a295e792e421f6c1537b2b21f8a7648683))
* **deps-dev:** bump lerna from 6.6.2 to 8.0.2 ([4b150ad](https://github.com/privacy-scaling-explorations/maci/commit/4b150ade7c4fbaf88eb0e1f629cec6749377706d))
* **deps-dev:** bump mocha from 10.2.0 to 10.3.0 ([2b76e04](https://github.com/privacy-scaling-explorations/maci/commit/2b76e0445f5da5864a335352f66eac33c070ab29))
* **domainobjs:** apply linter rules and fixes ([6649ca6](https://github.com/privacy-scaling-explorations/maci/commit/6649ca6d2afc83cfec60008fa6314add1cd837cd))
* **intergationTests:** apply linter for integration tests package ([ef75ec3](https://github.com/privacy-scaling-explorations/maci/commit/ef75ec37b2b4e000ad4b3fcdbdf85ba822690512))
* **key-change:** add tests and docs around key-change ([ce394e2](https://github.com/privacy-scaling-explorations/maci/commit/ce394e2d2bf3c8c6748cf8e8d1e401b8f3c924ee))
* linter ([42ea4f0](https://github.com/privacy-scaling-explorations/maci/commit/42ea4f0ae8b342f6bd5ca5ac86f1bdd143978324))
* linter unification ([61a8bcd](https://github.com/privacy-scaling-explorations/maci/commit/61a8bcd915fd3e4b4da3c00d40704d892c02f51b))
* **poll:** unify pollId type ([21d01ef](https://github.com/privacy-scaling-explorations/maci/commit/21d01efc565df74ea8b71dfeeead60be5a07db56))
* **publishing:** remove bash script for empty ballot roots contract ([025287c](https://github.com/privacy-scaling-explorations/maci/commit/025287c778547e0acb1582532f3412e022cca6fa))
* **release:** publish 1.1.2 ([10b3a85](https://github.com/privacy-scaling-explorations/maci/commit/10b3a85cc9b53c0fc1ccdf54221a48ec8d6efe0d))
* remove `gitHead` field from package.json ([d38ba71](https://github.com/privacy-scaling-explorations/maci/commit/d38ba71301469f350b3d80eab5bf94e779dda9cc))
* run prettier ([d09cd0e](https://github.com/privacy-scaling-explorations/maci/commit/d09cd0e01ac747245307ceec5343d9ed30d7a6f0))
* run prettier fix after bumping version ([e1f85a5](https://github.com/privacy-scaling-explorations/maci/commit/e1f85a53bbb72696b6998af5406748fd18df4701))
* **topup:** implement test cases for the topup feature ([7775a8b](https://github.com/privacy-scaling-explorations/maci/commit/7775a8b3295f29b098446d3e78a4200c03c847dd))



## [1.1.2](https://github.com/gurrpi/maci/compare/v1.1.1...v1.1.2) (2023-01-19)

### Miscellaneous

- add a badges to README.md ([888524b](https://github.com/gurrpi/maci/commit/888524baae82d56edbf0c794e587de174906c34c))
- **changelog:** add CHANGELOG of v1.1.1 ([ea1f0ca](https://github.com/gurrpi/maci/commit/ea1f0ca93f1618df0ba046f1f01b2abad57e0ee1))

## [1.1.1](https://github.com/gurrpi/maci/compare/v1.1.0...v1.1.1) (2022-12-03)

### Bug Fixes

- **core/ts/macistate.ts:** fix nothing_up_to_my_sleeve bug in MaciState.ts as well as unit tests ([3d2b21f](https://github.com/gurrpi/maci/commit/3d2b21f185c285542b92512a871b0886a3fedc83))
- **fix insert placeholder leaf bug:** fix issue related to first msg leaf ([b4b9da1](https://github.com/gurrpi/maci/commit/b4b9da1aff830daad2c70f530749df50cea9334f))
- **maci:** implemented fixes for several audit issues ([6f1fa85](https://github.com/gurrpi/maci/commit/6f1fa85299ebbc8fe10e30691afe8f036b8c68d1)), closes [#503](https://github.com/gurrpi/maci/issues/503) [#504](https://github.com/gurrpi/maci/issues/504) [#505](https://github.com/gurrpi/maci/issues/505) [#508](https://github.com/gurrpi/maci/issues/508) [#510](https://github.com/gurrpi/maci/issues/510)
- **maci:** reverted a fix and fixed test suits ([8300cc5](https://github.com/gurrpi/maci/commit/8300cc548e954a80ab6fb39ab9d559c999e07c10))
- **maci:** upgraded minor version and fixed bug in testnet deployment ([5ef5ed8](https://github.com/gurrpi/maci/commit/5ef5ed842360277ac823c6919e171d0c51ff5702)), closes [#551](https://github.com/gurrpi/maci/issues/551) [#552](https://github.com/gurrpi/maci/issues/552)
- **processmessages.circom:** data are not fully verified during state update ([6df6a40](https://github.com/gurrpi/maci/commit/6df6a4054da926b07f35c5befab4f1f8af33dcc6))
