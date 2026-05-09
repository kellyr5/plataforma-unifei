from django import forms
from django.contrib.auth.forms import ReadOnlyPasswordHashField
from django.core.exceptions import ValidationError

from autenticacao.models import Usuario


class UsuarioCreationForm(forms.ModelForm):
    """Formulario de criacao de usuario no admin com senha hasheada."""

    password1 = forms.CharField(label='Senha', widget=forms.PasswordInput)
    password2 = forms.CharField(label='Confirmar senha', widget=forms.PasswordInput)

    class Meta:
        model = Usuario
        fields = ('cpf', 'email', 'nome_completo')

    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            raise ValidationError('As senhas nao conferem.')
        return password2

    def save(self, commit=True):
        usuario = super().save(commit=False)
        usuario.set_password(self.cleaned_data['password1'])
        if commit:
            usuario.save()
        return usuario


class UsuarioChangeForm(forms.ModelForm):
    """Formulario de edicao de usuario no admin com senha como hash readonly."""

    password = ReadOnlyPasswordHashField(
        label='Senha',
        help_text=(
            'Senhas nao sao armazenadas em texto puro, entao nao ha como ve-la. '
            'Use <a href="../password/">este formulario</a> para alterar a senha.'
        ),
    )

    class Meta:
        model = Usuario
        fields = '__all__'
