import { validate } from 'class-validator';
import { ManageClientDependencyDto } from './manage-client-dependency.dto';

describe('ManageClientDependencyDto', () => {
  it.each([undefined, '', '   '])(
    'rejects an empty dependent client id: %p',
    async (dependentClientId) => {
      const dto = new ManageClientDependencyDto();
      dto.dependentClientId = dependentClientId;

      const errors = await validate(dto);

      expect(errors[0]?.property).toBe('dependentClientId');
    },
  );

  it('accepts a non-empty dependent client id', async () => {
    const dto = new ManageClientDependencyDto();
    dto.dependentClientId = 'dependent-id';

    await expect(validate(dto)).resolves.toEqual([]);
  });
});
