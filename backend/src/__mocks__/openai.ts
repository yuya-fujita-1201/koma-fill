class OpenAI {
  chat: {
    completions: {
      create: (args: unknown) => Promise<unknown>;
    };
  };

  images: {
    generate: (args: unknown) => Promise<unknown>;
  };

  constructor() {
    this.chat = {
      completions: {
        create: async () => {
          throw new Error('OpenAI mock not configured');
        },
      },
    };

    this.images = {
      generate: async () => {
        throw new Error('OpenAI mock not configured');
      },
    };
  }
}

export default OpenAI;
