'use strict';

/**
 * OnlyCat Event Constants
 * Based on the OnlyCat Home Assistant integration event definitions
 * Reference: https://github.com/OnlyCatAI/onlycat-home-assistant/blob/master/custom_components/onlycat/data/event.py
 * 
 */

// Event Classifications
const EVENT_CLASSIFICATION = {
  UNKNOWN: 0,
  CLEAR: 1,
  SUSPICIOUS: 2,
  CONTRABAND: 3,
  HUMAN_ACTIVITY: 4,
  REMOTE_UNLOCK: 10
};

// Event Trigger Sources
const EVENT_TRIGGER_SOURCE = {
  UNKNOWN: -1,
  MANUAL: 0,
  REMOTE: 1,
  INDOOR_MOTION: 2,
  OUTDOOR_MOTION: 3
};

// Event Types
const EVENT_TYPE = {
  UNKNOWN: 'unknown',
  CREATE: 'create',
  UPDATE: 'update'
};

// Event Classification Names (for logging)
const EVENT_CLASSIFICATION_NAMES = {
  [EVENT_CLASSIFICATION.UNKNOWN]: 'UNKNOWN',
  [EVENT_CLASSIFICATION.CLEAR]: 'CLEAR',
  [EVENT_CLASSIFICATION.SUSPICIOUS]: 'SUSPICIOUS',
  [EVENT_CLASSIFICATION.CONTRABAND]: 'CONTRABAND',
  [EVENT_CLASSIFICATION.HUMAN_ACTIVITY]: 'HUMAN_ACTIVITY',
  [EVENT_CLASSIFICATION.REMOTE_UNLOCK]: 'REMOTE_UNLOCK'
};

// Event Trigger Source Names (for logging)
const EVENT_TRIGGER_SOURCE_NAMES = {
  [EVENT_TRIGGER_SOURCE.UNKNOWN]: 'UNKNOWN',
  [EVENT_TRIGGER_SOURCE.MANUAL]: 'MANUAL',
  [EVENT_TRIGGER_SOURCE.REMOTE]: 'REMOTE',
  [EVENT_TRIGGER_SOURCE.INDOOR_MOTION]: 'INDOOR_MOTION',
  [EVENT_TRIGGER_SOURCE.OUTDOOR_MOTION]: 'OUTDOOR_MOTION'
};

module.exports = {
  EVENT_CLASSIFICATION,
  EVENT_TRIGGER_SOURCE,
  EVENT_TYPE,
  EVENT_CLASSIFICATION_NAMES,
  EVENT_TRIGGER_SOURCE_NAMES
};
