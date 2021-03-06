describe('building: link', function() {

    it('knows all individual values going through', function() {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);
            outlet.send(5);

            expect(updateSpy).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'link/pass',
                                           link: link,
                                           value: 5 }));
        });
    });

    it('knows streams of values going through', function(done) {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);

            var userSequence = [ 2, 'foo', { 'foo': 'bar' } ];
            var period = 30;

            outlet.stream(Kefir.sequentially(period, userSequence));

            setTimeout(function() {
                for (var i = 0; i < userSequence.length; i++) {
                    expect(updateSpy).toHaveBeenCalledWith(
                        jasmine.objectContaining({ type: 'link/pass',
                                                   link: link,
                                                   value: userSequence[i] }));
                }
                done();
            }, period * (userSequence.length + 1));
        });
    });

    it('gets individual values from connected outlet and passes them to connected inlet', function() {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);
            outlet.send(5);

            expect(updateSpy).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'inlet/update',
                                           inlet: inlet,
                                           value: 5 }));

        });
    });

    it('gets streams of values from connected outlet and passes them to connected inlet', function(done) {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);

            var userSequence = [ 2, 'foo', { 'foo': 'bar' } ];
            var period = 30;

            outlet.stream(Kefir.sequentially(period, userSequence));

            setTimeout(function() {
                for (var i = 0; i < userSequence.length; i++) {
                    expect(updateSpy).toHaveBeenCalledWith(
                        jasmine.objectContaining({ type: 'inlet/update',
                                                   inlet: inlet,
                                                   value: userSequence[i] }));

                }
                done();
            }, period * (userSequence.length + 1));
        });
    });

    it('could be disabled', function() {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);
            link.disable();
            outlet.send(5);

            expect(updateSpy).not.toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'inlet/update',
                                           inlet: inlet }));
        });
    });

    it('receives last value again when it was enabled back', function() {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);
            outlet.send(1);
            outlet.send(5);
            link.disable();

            updateSpy.calls.reset();
            link.enable();

            expect(updateSpy).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'inlet/update',
                                           inlet: inlet,
                                           value: 5 }));
        });
    });

    it('receives last value when it was enabled back, even when this value was sent while it was disabled', function() {
        withNewPatch(function(patch, updateSpy) {

            var sending = patch.addNode('spec/empty');
            var outlet = sending.addOutlet('spec/any', 'bar');

            var receiving = patch.addNode('spec/empty');
            var inlet = receiving.addInlet('spec/any', 'foo');

            var link = outlet.connect(inlet);
            outlet.send(1);
            link.disable();
            outlet.send(5);

            updateSpy.calls.reset();
            link.enable();

            expect(updateSpy).toHaveBeenCalledWith(
                jasmine.objectContaining({ type: 'inlet/update',
                                           inlet: inlet,
                                           value: 5 }));
        });
    });

});
