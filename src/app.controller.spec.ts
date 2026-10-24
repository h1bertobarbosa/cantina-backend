import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(() => {
    controller = new AppController();
  });

  describe('GET /healthcheck', () => {
    it('returns status UP', () => {
      expect(controller.getHello()).toEqual({ status: 'UP' });
    });
  });
});
