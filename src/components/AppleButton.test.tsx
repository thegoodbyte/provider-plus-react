import React from 'react';
import {render,screen} from '@testing-library/react';
import AppleButton from './AppleButton';

it('retains the accessible action name and disables duplicate submission while loading',()=>{
 const click=jest.fn();render(<AppleButton aria-label="Create Client" loading onClick={click}>Create Client</AppleButton>);
 const button=screen.getByRole('button',{name:'Create Client'});expect(button).toBeDisabled();expect(button).toHaveAttribute('aria-busy','true');button.click();expect(click).not.toHaveBeenCalled();
});
