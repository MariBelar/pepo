([
    {
        tech: 'js',
        shouldDeps: [
            {
                block: 'user-info',
                tech: 'bemtree'
            },
            // TODO, it's nested from user-info. We should ask someone how it should be...
            {
                block: 'userpic',
                tech: 'bemhtml'
            },
            {
                block: 'username',
                tech: 'bemhtml'
            },
            {
                block: 'image',
                tech: 'bemhtml'
            }
        ]
    },
    {
        mustDeps: 'stylus-vars',
        shouldDeps: [
            {
                block: 'form'
            },
            {
                block: 'i-bem',
                elem: 'dom'
            },
            {
                block: 'input',
                mods: {
                    theme: 'islands',
                    size: 'xl',
                    width: 'available',
                    type: 'search',
                    'has-clear': true
                }
            },
            {
                block: 'spinner'
            }
        ]
    }
]);
