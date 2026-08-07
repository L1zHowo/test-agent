import { SkillService } from './skill.service';

describe('SkillService builtin tool schemas', () => {
  let service: SkillService;

  beforeEach(() => {
    service = new SkillService({} as any);
  });

  it('exposes every builtin input as an object JSON Schema', async () => {
    const skills = await service.getBuiltinSkills();

    expect(skills).toHaveLength(6);
    for (const skill of skills) {
      expect(skill.inputSchema).toEqual(
        expect.objectContaining({
          type: 'object',
          properties: expect.any(Object),
          additionalProperties: false,
        }),
      );
    }
  });

  it.each([
    ['time', []],
    ['http', ['url']],
    ['json', ['action', 'data']],
    ['regex', ['text', 'pattern']],
    ['calculator', ['expression']],
    ['code', ['code']],
  ])('declares required parameters for %s', async (type, required) => {
    const skills = await service.getBuiltinSkills();
    const skill = skills.find((item) => item.type === type);

    expect(skill).toBeDefined();
    expect(skill!.inputSchema.required || []).toEqual(required);
  });
});
