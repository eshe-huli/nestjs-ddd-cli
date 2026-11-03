## [3.3.1](https://github.com/eshe-huli/nestjs-ddd-cli/compare/v3.3.0...v3.3.1) (2026-11-03)

### Bug Fixes

* **release:** upload one installable package archive ([9eda21e](https://github.com/eshe-huli/nestjs-ddd-cli/commit/9eda21ec304be0378dc2f926491698e35b9aae5a))

## [3.3.0](https://github.com/eshe-huli/nestjs-ddd-cli/compare/v3.2.2...v3.3.0) (2026-11-03)

### ⚠ BREAKING CHANGES

* **generator:** The next published CLI requires Node >=18 instead of the previously published package's Node >=14. This matches the existing checked-in maintained-runtime contract. Node 14/16 users must retain version 3.2.2; this release must use the next major version rather than silently changing their supported runtime in a minor update.

### Features

* add external projection worker recipe [skip ci] ([49fbc10](https://github.com/eshe-huli/nestjs-ddd-cli/commit/49fbc100c8dc2d218a6cd2ec0e81db062fdce8ef))
* add oidc dashboard recipe ([45b671d](https://github.com/eshe-huli/nestjs-ddd-cli/commit/45b671d5ce359fd780bc843b2dd2388870e5f28a))
* add platform connector recipes ([007cee6](https://github.com/eshe-huli/nestjs-ddd-cli/commit/007cee606f0e5773d0c92a49ec52eb278fa6e890))
* add platform event backbone recipes ([56a3a52](https://github.com/eshe-huli/nestjs-ddd-cli/commit/56a3a5218b4858e3804324e1bff3662132658260))
* add Service Access request context recipe ([06db2fa](https://github.com/eshe-huli/nestjs-ddd-cli/commit/06db2fa0da7bbc7c7f2169d7853b20a2f70e3c94))
* add transactional Kafka consumer recipe ([9f3afc3](https://github.com/eshe-huli/nestjs-ddd-cli/commit/9f3afc3c75a00ddbdff8d4cbe86206b10c754cca))
* **auth:** generate explicit PARC bound authorization client ([cf68332](https://github.com/eshe-huli/nestjs-ddd-cli/commit/cf683328e3f09aae29a22ee7e451a33b3a11d1a3))
* checkpoint OIDC resource server recipe for review ([a3795be](https://github.com/eshe-huli/nestjs-ddd-cli/commit/a3795be263d6644bc5dd5b332fe02d432a2d2da2))
* emit framework-independent bounded HTTP transport ([6478a3e](https://github.com/eshe-huli/nestjs-ddd-cli/commit/6478a3e6529f0de357cae6026eb6f36c47dffd75))
* generate application controller shells ([cc8a0b4](https://github.com/eshe-huli/nestjs-ddd-cli/commit/cc8a0b43e5802490a0f8bb10f4accff807ca59a7))
* generate bounded confidential OIDC BFF sessions ([8a0a42b](https://github.com/eshe-huli/nestjs-ddd-cli/commit/8a0a42bf562a91162c6a752051f3e541817b2131))
* generate bounded OAuth2 token introspection ([8fe695d](https://github.com/eshe-huli/nestjs-ddd-cli/commit/8fe695d8d6893c26d88fb6d47e32649a3aa93801))
* generate dependency-free OIDC verifier ([35fc398](https://github.com/eshe-huli/nestjs-ddd-cli/commit/35fc3981bdd8d9a07b5bdb543d6cbd31392fc4e8))
* generate immutable migration deployment gate [skip ci] ([6277dea](https://github.com/eshe-huli/nestjs-ddd-cli/commit/6277dea61519d8fb6b288a78805d2c29a682e955))
* **generate:** add standalone dto generator ([586ed08](https://github.com/eshe-huli/nestjs-ddd-cli/commit/586ed08af65c79eeeedf3098b2c31929b746e119))
* **generator:** add financial-safe field contracts ([9d14e49](https://github.com/eshe-huli/nestjs-ddd-cli/commit/9d14e4914316d7625716b4ac2cb203f15fdcbda1))
* **generator:** deliver verified identity recipes for maintained Node runtimes ([53ca0a9](https://github.com/eshe-huli/nestjs-ddd-cli/commit/53ca0a9f7c946e0617708deae2915e96de52acc1))
* harden oidc dashboard recipe ([c6a5077](https://github.com/eshe-huli/nestjs-ddd-cli/commit/c6a5077666271b5389381cbfee5e5b2cc115a714))
* **init:** allow explicit Bun execution with installed schematics ([7878389](https://github.com/eshe-huli/nestjs-ddd-cli/commit/78783896fdd4a40402df0f3adf0a89a16c85eb16))
* **recipe:** add bounded client credentials and JSON POST transport ([c7656da](https://github.com/eshe-huli/nestjs-ddd-cli/commit/c7656da8092ec22feefcc3d1a7c9236af8288f17))
* **recipes:** add fail-closed PARC authorization ([1791c45](https://github.com/eshe-huli/nestjs-ddd-cli/commit/1791c45cd8cd7752b8dae893898ea17a70911cbe))
* **recipes:** add platform runtime registration ([6c8afe9](https://github.com/eshe-huli/nestjs-ddd-cli/commit/6c8afe9ed7439b85e5d6bcbc7d83521045c3bb09))
* **recipes:** add Relay HTTP event transport ([1088a4c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/1088a4cd71c6fa3aa25e19f3082387f1fda88fd5))
* **recipes:** add trusted platform context contract ([d19e181](https://github.com/eshe-huli/nestjs-ddd-cli/commit/d19e1812a01694b80bbb9436b6c3b9aeb1223dff))
* **recipes:** bind OIDC to platform context ([4e68acf](https://github.com/eshe-huli/nestjs-ddd-cli/commit/4e68acf07768be16e0e951e2611a933d795818a4))
* **recipe:** support ESM Nest configuration in CommonJS Jest ([5f8de51](https://github.com/eshe-huli/nestjs-ddd-cli/commit/5f8de519ab979dd1fc71cc7e8ca8123267e7d35e))
* **scaffold:** add explicit no-delete mode ([63da6c4](https://github.com/eshe-huli/nestjs-ddd-cli/commit/63da6c484ff0fc20a61cbafd09e290997bb1625e))
* share bounded JSON transport in token introspection recipe ([f57e33c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/f57e33c5234e47cf8c731c04c3c9c3d8e177054d))
* **transport:** support bounded explicit JSON PATCH requests ([c4075d5](https://github.com/eshe-huli/nestjs-ddd-cli/commit/c4075d527cd401c8a05135600140b06e4a5fc733))
* **transport:** support bounded explicit JSON PUT requests ([8b54d8f](https://github.com/eshe-huli/nestjs-ddd-cli/commit/8b54d8f8697921d7ec21e2eeea6444ffaae19195))

### Bug Fixes

* accept postgres URLs in Joi recipe ([4e107f2](https://github.com/eshe-huli/nestjs-ddd-cli/commit/4e107f26d6289c800152bfc87b388a5ac8f9af93))
* add dry-run to focused generators ([89f9672](https://github.com/eshe-huli/nestjs-ddd-cli/commit/89f9672c51dc6f00a276781af4b5333e96ec54c6))
* add migration generator dry run ([49b716e](https://github.com/eshe-huli/nestjs-ddd-cli/commit/49b716e3771b0d934a0a02b4440b175450232ac8))
* align generated ai context with contracts ([c0c44c1](https://github.com/eshe-huli/nestjs-ddd-cli/commit/c0c44c1d5a3cdd37df1786bc55218c4ca11be4bc))
* **auth:** reject IAM realm downgrade in legacy PARC recipes ([67b6c19](https://github.com/eshe-huli/nestjs-ddd-cli/commit/67b6c198c8c9c7cb8a0ce53ea0b1c69644709e70))
* **ci:** publish CLI with supported Node LTS ([ace4c2f](https://github.com/eshe-huli/nestjs-ddd-cli/commit/ace4c2fad27d8a4bfae11f20f4e06d8804cea36f))
* **ci:** scope semantic release write permissions ([fd0da13](https://github.com/eshe-huli/nestjs-ddd-cli/commit/fd0da13a20846c7cc533065af924e8aaf914248a))
* **cli:** keep recipe help discoverable ([59c66c5](https://github.com/eshe-huli/nestjs-ddd-cli/commit/59c66c50a6d58c16a80f8a69f3f32660d60e9850))
* close projection worker ordering gaps [skip ci] ([f543b9c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/f543b9cba5b8c065684521dda9e8f2cf700c1a43))
* emit lint-clean auth and logging infrastructure ([0209b7f](https://github.com/eshe-huli/nestjs-ddd-cli/commit/0209b7f0001cdfcb4c0f00b14c4b32cdfc7f3d95))
* generate resolvable scaffold test imports ([118162d](https://github.com/eshe-huli/nestjs-ddd-cli/commit/118162d2e30cc4444e3b781ae866fef152601b06))
* **generate:** register generated domain services ([6dc5d12](https://github.com/eshe-huli/nestjs-ddd-cli/commit/6dc5d12ea54247570e4e6d409418786f8cbcf5d1))
* **generate:** register query handlers in module barrels ([2c39249](https://github.com/eshe-huli/nestjs-ddd-cli/commit/2c392495cd07687e64173b3a64cda052bda7c240))
* **generator:** avoid whitespace-only migration lines ([5170d76](https://github.com/eshe-huli/nestjs-ddd-cli/commit/5170d76a838c89b5b6abe4c21204e433acceb890))
* **generator:** keep emitted BFF specs strictly typed ([62f92b1](https://github.com/eshe-huli/nestjs-ddd-cli/commit/62f92b17200beab0d5675f1de855f27e07f7f163))
* **generator:** namespace repository pagination contracts ([0322f1c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/0322f1c9abc3ef7c27c1642651af1ecad2a44bf6))
* **generator:** normalize DDD query contracts ([e295c1b](https://github.com/eshe-huli/nestjs-ddd-cli/commit/e295c1ba612d1ee7c6104300832fe4299bef7500))
* **generator:** render typed filter queries safely ([5b79e75](https://github.com/eshe-huli/nestjs-ddd-cli/commit/5b79e7576500f0998585831d1f4ecdc6592b9901))
* **generator:** skip base entity fields ([f7c4101](https://github.com/eshe-huli/nestjs-ddd-cli/commit/f7c4101e280447139e49b2326a2ca22b135aff76))
* harden external projection worker recipe [skip ci] ([112cb52](https://github.com/eshe-huli/nestjs-ddd-cli/commit/112cb5202b671415968ed96a5e9439522dbd83e5))
* harden generated migration deployment [skip ci] ([54f84bd](https://github.com/eshe-huli/nestjs-ddd-cli/commit/54f84bd6d1593fa87ad9451bbaaddcdce935b460))
* harden project and ddd generators ([0daf121](https://github.com/eshe-huli/nestjs-ddd-cli/commit/0daf121d609d844b65580de68c7ad608bb3705c3))
* keep migration runner CommonJS-safe [skip ci] ([33a09bd](https://github.com/eshe-huli/nestjs-ddd-cli/commit/33a09bd1b9a5e4a8459c6435852779ea621d6cc2))
* **logging:** generate native request UUIDs without implicit dependencies ([d52630c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/d52630ce72c5c0ad391e97e31f00a60ae87a6f05))
* make doctor resolve project dependencies ([684b03e](https://github.com/eshe-huli/nestjs-ddd-cli/commit/684b03ede3e959ded864babcad5c6f0c071ef42e))
* make repository deletion generation config-safe ([983b7cb](https://github.com/eshe-huli/nestjs-ddd-cli/commit/983b7cb96111a674d4a6aaca9e69c82e871f178d))
* pin numeric migration runtime identity [skip ci] ([5424f1b](https://github.com/eshe-huli/nestjs-ddd-cli/commit/5424f1beacab81d6aca9cb9e68f284635502791f))
* preserve repository names and module paths ([676eee5](https://github.com/eshe-huli/nestjs-ddd-cli/commit/676eee5abda33d7cee00a297cb7cb741544855e4))
* **recipe:** keep JSON prototype evidence strictly typed ([bcc3949](https://github.com/eshe-huli/nestjs-ddd-cli/commit/bcc394938f2db95f7bb958ba265899c7e40d8635))
* **recipes:** align platform decision receipts ([f1d988b](https://github.com/eshe-huli/nestjs-ddd-cli/commit/f1d988bae38c787480759c9fee612b17c12dc96a))
* **recipes:** harden event backbone generation ([ba3a9fc](https://github.com/eshe-huli/nestjs-ddd-cli/commit/ba3a9fc9943617061513eaca8fe2de097fb6888c))
* **release:** install the configured conventional commits preset ([b0f5aad](https://github.com/eshe-huli/nestjs-ddd-cli/commit/b0f5aadbb4b879ff9ce3e9c4d14c9c90c8ae7873))
* **release:** retain strict workflow checks with OIDC permission ([4bb3545](https://github.com/eshe-huli/nestjs-ddd-cli/commit/4bb35450b2a4a0a15b207626712bbd79d048aa9a))
* **release:** select the OIDC-capable npm plugin explicitly ([34855a9](https://github.com/eshe-huli/nestjs-ddd-cli/commit/34855a946dec7fcbda0ab2211ed1ba3caa348c2f))
* **release:** use npm trusted publishing for authorized CLI releases ([39fb7cf](https://github.com/eshe-huli/nestjs-ddd-cli/commit/39fb7cfd872b2ac45a4de03903134503e609e996))
* repair enhanced doctor project resolution ([a584741](https://github.com/eshe-huli/nestjs-ddd-cli/commit/a584741ce06ee690f66e9d1ebe3060deb8935ff2))
* **scaffold:** honor configured migration path ([a280cdd](https://github.com/eshe-huli/nestjs-ddd-cli/commit/a280cdd558f33e3b9a922c24743436c66a87ee18))
* support monorepo doctor targets ([ebf1213](https://github.com/eshe-huli/nestjs-ddd-cli/commit/ebf1213d4ebbed7693e1a1f7b7a99149ae4f78fa))
* support monorepo migration paths ([1746be5](https://github.com/eshe-huli/nestjs-ddd-cli/commit/1746be580cb107f35cd8455186f8fc17db0d78d3))

### Documentation

* **auth:** define tenant selection and commit-time bound authority ([8420e67](https://github.com/eshe-huli/nestjs-ddd-cli/commit/8420e674a8348d5f672423c8afb1ddbf8de92f38))
* **auth:** distinguish IAM-verified staff from shared external context ([280030c](https://github.com/eshe-huli/nestjs-ddd-cli/commit/280030c76c14d752a2ce55c6c73c4b07ae83e115))
* record aggregate identity generator proof ([8cb2cf4](https://github.com/eshe-huli/nestjs-ddd-cli/commit/8cb2cf47d48f85b8cfde17c77a0b63afa2ced2b0))

### Code Refactoring

* **recipe:** share successor-safe static write plan ([ba91b5d](https://github.com/eshe-huli/nestjs-ddd-cli/commit/ba91b5d1f0748c61b51e9c2a61ee0de01537dd32))
