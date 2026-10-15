var vows = require('vows'),
  assert = require('assert'),
  filter_helper = require('./filter_helper');

vows.describe('Filter cucm ').addBatch({
  'cdr row after header': filter_helper.create('cucm', '', [
    {
      message: 'cdrRecordType,globalCallID_callManagerId,globalCallID_callId',
    },
    {
      message: '1,2,28377',
    },
  ], [
    {
      cdrRecordType: '1',
      globalCallID_callManagerId: '2',
      globalCallID_callId: '28377',
      type: 'cucm_cdr',
    },
  ]),
}).export(module);
