#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { MEStack } from "../lib/me-stack";
import { AgreementStack } from "../lib/agreement-stack";
import { SubscriberStack } from "../lib/subscriber-stack";
import { PublisherStack } from "../lib/publisher-stack";
import { ProvisionStack } from "../lib/provision-stack";
import { FixityStack } from "../lib/fixity/fixity-stack";
import { FixityRepositoryStack } from "../lib/fixity/fixity-repository-stack";
import { MediaSyncStack } from "../lib/mediasync/mediasync-stack";
import { MediaSyncRepositoryStack } from "../lib/mediasync/mediasync-repository-stack";
import { AutoIngestStack } from "../lib/autoingest/autoingest-stack";
import { DefaultStackSynthesizer } from "aws-cdk-lib";

const app = new cdk.App();

// Fixity
new FixityStack(app, "FixityStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new FixityRepositoryStack(app, "FixityRepositoryStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

// MediaSync
new MediaSyncStack(app, "MediaSyncStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new MediaSyncRepositoryStack(app, "MediaSyncRepositoryStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

// Autoingest
new AutoIngestStack(app, "AutoIngestStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

// Media Exchange Solution Templates
new MEStack(app, "MEStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new AgreementStack(app, "AgreementStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new SubscriberStack(app, "SubscriberStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new PublisherStack(app, "PublisherStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});

new ProvisionStack(app, "ProvisionStack", { // NOSONAR
  synthesizer: new DefaultStackSynthesizer({
    generateBootstrapVersionRule: false,
  }),
});
