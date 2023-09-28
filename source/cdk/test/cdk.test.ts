import { Template } from "aws-cdk-lib/assertions";
import * as MediaExchange from "../lib/me-stack";
import * as Agreement from "../lib/agreement-stack";
import * as Provision from "../lib/provision-stack";
import * as Subscriber from "../lib/subscriber-stack";
import * as Publisher from "../lib/publisher-stack";
import * as Fixity from "../lib/fixity/fixity-stack";
import * as FixityRepo from "../lib/fixity/fixity-repository-stack";
import * as MediaSync from "../lib/mediasync/mediasync-stack";
import * as MediaSyncRepo from "../lib/mediasync/mediasync-repository-stack";
import * as Autoingest from "../lib/autoingest/autoingest-stack";
import { Stack } from "aws-cdk-lib";

const regexHashedFileName = /[A-Fa-f0-9]{64}(\.[a-z]{3,4})$/;
const replaceHashedName = "[HASH REMOVED]$1";

expect.addSnapshotSerializer({
    test: (val) => typeof val === 'string' && regexHashedFileName.test(val),
    serialize: (val) => JSON.stringify(val.replace(regexHashedFileName, replaceHashedName)),
});

test("ME Stack Test", () => {
  const stack = new Stack();
  const meTest = new MediaExchange.MEStack(stack, "MediaExchange");
  const template = Template.fromStack(meTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Agreement Stack Test", () => {
  const stack = new Stack();
  const agreementTest = new Agreement.AgreementStack(stack, "Agreement");
  const template = Template.fromStack(agreementTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Provision Stack Test", () => {
  const stack = new Stack();
  const provisionTest = new Provision.ProvisionStack(stack, "Provision");
  const template = Template.fromStack(provisionTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Subscriber Stack Test", () => {
  const stack = new Stack();
  const subscriberTest = new Subscriber.SubscriberStack(stack, "Subscriber");
  const template = Template.fromStack(subscriberTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Publisher Stack Test", () => {
  const stack = new Stack();
  const publisherTest = new Publisher.PublisherStack(stack, "Publisher");
  const template = Template.fromStack(publisherTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Fixity Stack Test", () => {
  const stack = new Stack();
  const fixityTest = new Fixity.FixityStack(stack, "Fixity");
  const template = Template.fromStack(fixityTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Fixity Repo Stack Test", () => {
  const stack = new Stack();
  const fixityRepoTest = new FixityRepo.FixityRepositoryStack(
    stack,
    "FixityRepo"
  );
  const template = Template.fromStack(fixityRepoTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("MediaSync Stack Test", () => {
  const stack = new Stack();
  const mediaSyncTest = new MediaSync.MediaSyncStack(stack, "MediaSync");
  const template = Template.fromStack(mediaSyncTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("Mediasync Repo Stack Test", () => {
  const stack = new Stack();
  const mediaSyncRepoTest = new MediaSyncRepo.MediaSyncRepositoryStack(
    stack,
    "MediaSyncRepo"
  );
  const template = Template.fromStack(mediaSyncRepoTest);
  expect(template.toJSON()).toMatchSnapshot();
});

test("AutoIngest Stack Test", () => {
  const stack = new Stack();
  const autoIngestTest = new Autoingest.AutoIngestStack(stack, "AutoIngest");
  const template = Template.fromStack(autoIngestTest);
  expect(template.toJSON()).toMatchSnapshot();
});
