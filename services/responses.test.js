'use strict';

const _startCase = require('lodash/startCase'),
  bluebird = require('bluebird'),
  filename = __filename.split('/').pop().split('.').shift(),
  lib = require(`./${filename}`),
  createMockRes = require('../test/fixtures/mocks/res'),
  storage = require('../test/fixtures/mocks/storage');

describe(_startCase(filename), function () {
  let fakeLog,
    fakeDb,
    mockRes;

  beforeEach(function () {
    fakeLog = jest.fn();
    fakeDb = storage();
    mockRes = createMockRes();
    mockRes.status = jest.fn().mockReturnThis();

    lib.setLog(fakeLog);
    lib.setDb(fakeDb);
  });

  /**
   * Shortcut
   *
   * @param {object} res
   * @param {object} expected
   * @param {Function} done
   */
  function expectResult(res, expected, done) {
    jest.spyOn(res, 'send')
      .mockImplementation(function (result) {
        expect(result).toEqual(expected);
        done();
      });
  }

  describe('handleError', function () {
    const fn = lib[this.description];

    it('should send 404 if "not found"', function (done) {
      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).not.toBeCalled();
        expect(mockRes.status).toBeCalledWith(404);
        done();
      });
      fn(mockRes)(new Error('not found'));
    });

    it('sends 500 and logs error', function (done) {
      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).toBeCalledWith('error', 'something', expect.any(Object));
        expect(mockRes.status).toBeCalledWith(500);
        done();
      });
      fn(mockRes)(new Error('something'));
    });

    it('sends the error code defined in the `status` property', function (done) {
      const myError = new Error('something');

      myError.status = 403;

      expectResult(mockRes, 'sendStatus: whatever', done);
      fn(mockRes)(myError);
      expect(mockRes.status).toBeCalledWith(403);
    });
  });

  describe('expectJSON', function () {
    const fn = lib[this.description];

    it('sends json', function (done) {
      const data = {},
        res = createMockRes({ formatter: 'json' });

      res.status = jest.fn().mockReturnThis();

      expectResult(res, data, function () {
        expect(fakeLog).not.toBeCalled();
        done();
      });
      fn(function () {
        return data;
      }, res);
    });

    it('404s on Error "not found"', function (done) {
      const res = createMockRes({ formatter: 'json' });

      res.status = jest.fn().mockReturnThis();

      expectResult(res, {
        message: 'Not Found',
        code: 404
      }, function () {
        expect(fakeLog).not.toBeCalled();
        expect(res.status).toBeCalledWith(404);
        done();
      });
      fn(function () {
        throw Error('something not found: etc etc');
      }, res);
    });
  });

  describe('clientError', function () {
    const fn = lib[this.description];

    it('sends 400', function (done) {

      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).toBeCalledWith('error', 'something', expect.any(Object));
        expect(mockRes.status).toBeCalledWith(400);
        done();
      });
      fn(new Error('something'), mockRes);
    });
  });

  describe('serverError', function () {
    const fn = lib[this.description];

    it('sends 500 and logs error', function (done) {

      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).toBeCalledWith('error', 'something', expect.any(Object));
        expect(mockRes.status).toBeCalledWith(500);
        done();
      });
      fn(new Error('something'), mockRes);
    });

    it('returns "Server Error" message', function (done) {
      let err = new Error('something');

      // Reset the error message to test for default response
      err.message = '';
      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).toBeCalledWith('error', '', expect.any(Object));
        expect(mockRes.status).toBeCalledWith(500);
        done();
      });
      fn(err, mockRes);
    });
  });

  describe('varyWithoutExtension', function () {
    const fn = lib[this.description];

    it('adds vary without extension', function (done) {
      const req = {
          path: '/hey',
          baseUrl: '',
          url: ''
        },
        res = createMockRes();

      res.set = jest.fn();

      fn({ varyBy: ['whatever'] })(req, res, function () {
        expect(fakeLog).not.toBeCalled();
        expect(res.set).toBeCalledWith('Vary', 'whatever');
        done();
      });
    });

    it('does not add vary with extension', function (done) {
      const req = {
          path: '/hey.html',
          baseUrl: '',
          url: ''
        },
        res = createMockRes();

      res.set = jest.fn();

      fn({ varyBy: ['whatever'] })(req, res, function () {
        expect(fakeLog).not.toBeCalled();
        expect(res.set).toBeCalledWith('Vary', 'whatever');
        done();
      });
    });
  });

  describe('methodNotAllowed', function () {
    const fn = lib[this.description];

    it('blocks when not allowed', function (done) {
      const allowed = ['something'],
        req = { method: 'somethingElse' },
        res = createMockRes({ formatter: 'json' });

      res.status = jest.fn().mockReturnThis();

      expectResult(res, {
        allow: allowed,
        code: 405,
        message: 'Method somethingElse not allowed'
      }, function () {
        expect(fakeLog).not.toBeCalled();
        expect(res.status).toBeCalledWith(405);
        done();
      });
      fn({ allow: allowed })(req, res);
    });

    it('does not block when allowed', function (done) {
      const req = { method: 'something' },
        res = createMockRes({ formatter: 'json' });

      res.status = jest.fn().mockReturnThis();

      fn({ allow: ['something'] })(req, res, function () {
        expect(fakeLog).not.toBeCalled();
        done();
      });
    });
  });

  describe('denyReferenceAtRoot', function () {
    const fn = lib[this.description];

    it('should block if _ref is at root of body', function (done) {
      const req = {
        body: { _ref: 'foo' }
      };

      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(mockRes.status).toBeCalledWith(400);
        done();
      });
      fn(req, mockRes, done);
    });

    it('should not block if there is no _ref at root of body', function (done) {
      const req = { body: {} };

      expectResult(mockRes, 'sendStatus: whatever', function () {
        done();
      });
      fn(req, mockRes, done);
    });
  });

  describe('denyTrailingSlashOnId', function () {
    const fn = lib[this.description];

    it('should deny if there is slash after path', function (done) {
      const req = { path: '/foo/' };

      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(mockRes.status).toBeCalledWith(400);
        done();
      });
      fn(req, mockRes, done);
    });

    it('should allow if there is no slash after path', function (done) {
      const req = { path: '/foo' };

      expectResult(mockRes, 'sendStatus: whatever', function () {
        expect(fakeLog).not.toBeCalled();
        done();
      });
      fn(req, mockRes, done);
    });
  });

  describe.only('listUsers', function () {
    const fn = lib[this.description],
      expected = [
        '/_users/a',
        '/_users/aa',
        '/_users/aaa',
        '/_users/c',
        '/_users/cc',
        '/_users/ccc',
        '/_users/e'
      ];

    beforeEach(function () {
      return fakeDb.clearMem().then(function () {
        return bluebird.join(
          fakeDb.writeToInMem('/_users/a', 'b'),
          fakeDb.writeToInMem('/_users/aa', 'b'),
          fakeDb.writeToInMem('/_users/aaa', 'b'),
          fakeDb.writeToInMem('/_users/c', 'd'),
          fakeDb.writeToInMem('/_users/cc', 'd'),
          fakeDb.writeToInMem('/_users/ccc', 'd'),
          fakeDb.writeToInMem('/_users/e', 'f')
        );
      });
    });

    afterEach(function () {
      fakeDb.clearMem();
    });

    it('lists users under a domain', function (done) {
      const req = {
        hostname: 'base.com',
        baseUrl: '',
        path: '/_users/'
      };

      expectResult(mockRes, JSON.stringify(expected.map(user => `${req.hostname}${user}`)), function () {
        expect(fakeLog).not.toBeCalled();
        done();
      });
      fn()(req, mockRes);
    });

    it('lists users under a domain with a path', function (done) {
      const req = {
        hostname: 'base.com',
        baseUrl: '',
        path: '/some/path/_users/'
      };

      expectResult(mockRes, JSON.stringify(expected.map(user => `${req.hostname}/some/path${user}`)), function () {
        expect(fakeLog).not.toBeCalled();
        done();
      });
      fn()(req, mockRes);
    });
  });
});