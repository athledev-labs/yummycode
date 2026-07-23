export class CatsController {
  // @Get('/ignored') in a comment must not count.
  getList() {}

  createOne() {}
}

// Real Nest-style decorators (kept out of the class body for the fixture).
const _decorators = `
  @Get('/list')
  @Post()
`;
