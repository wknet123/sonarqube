/*
 * SonarQube
 * Copyright (C) 2009-2019 SonarSource SA
 * mailto:info AT sonarsource DOT com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program; if not, write to the Free Software Foundation,
 * Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */
import * as React from 'react';
import * as classNames from 'classnames';
import OrganizationInput from './OrganizationInput';
import DeferredSpinner from '../../../components/common/DeferredSpinner';
import { SubmitButton } from '../../../components/ui/buttons';
import { createProject } from '../../../api/components';
import { translate } from '../../../helpers/l10n';
import ProjectKeyInput from '../components/ProjectKeyInput';
import ProjectNameInput from '../components/ProjectNameInput';
import VisibilitySelector from '../../../components/common/VisibilitySelector';
import { isSonarCloud } from '../../../helpers/system';
import UpgradeOrganizationBox from '../components/UpgradeOrganizationBox';
import './ManualProjectCreate.css';

interface Props {
  currentUser: T.LoggedInUser;
  fetchMyOrganizations: () => Promise<void>;
  onProjectCreate: (projectKeys: string[]) => void;
  organization?: string;
  userOrganizations: T.Organization[];
}

interface State {
  projectName?: string;
  projectKey?: string;
  selectedOrganization?: T.Organization;
  selectedVisibility?: T.Visibility;
  submitting: boolean;
}

type ValidState = State &
  Required<Pick<State, 'projectName' | 'projectKey' | 'selectedOrganization'>>;

export default class ManualProjectCreate extends React.PureComponent<Props, State> {
  mounted = false;

  constructor(props: Props) {
    super(props);
    this.state = {
      selectedOrganization: this.getInitialSelectedOrganization(props),
      submitting: false
    };
  }

  componentDidMount() {
    this.mounted = true;
  }

  componentWillUnmount() {
    this.mounted = false;
  }

  canChoosePrivate = (selectedOrganization: T.Organization | undefined) => {
    return Boolean(selectedOrganization && selectedOrganization.subscription === 'PAID');
  };

  canSubmit(state: State): state is ValidState {
    return Boolean(state.projectKey && state.projectName && state.selectedOrganization);
  }

  getInitialSelectedOrganization = (props: Props) => {
    if (props.organization) {
      return this.getOrganization(props.organization);
    } else if (props.userOrganizations.length === 1) {
      return props.userOrganizations[0];
    } else {
      return undefined;
    }
  };

  getOrganization = (organizationKey: string) => {
    return this.props.userOrganizations.find(({ key }: T.Organization) => key === organizationKey);
  };

  handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { state } = this;
    if (this.canSubmit(state)) {
      this.setState({ submitting: true });
      createProject({
        project: state.projectKey,
        name: state.projectName,
        organization: state.selectedOrganization.key,
        visibility: this.state.selectedVisibility
      }).then(
        ({ project }) => this.props.onProjectCreate([project.key]),
        () => {
          if (this.mounted) {
            this.setState({ submitting: false });
          }
        }
      );
    }
  };

  handleOrganizationSelect = ({ key }: T.Organization) => {
    const selectedOrganization = this.getOrganization(key);
    let { selectedVisibility } = this.state;

    if (selectedVisibility === undefined) {
      selectedVisibility = this.canChoosePrivate(selectedOrganization) ? 'private' : 'public';
    }

    this.setState({
      selectedOrganization,
      selectedVisibility
    });
  };

  handleOrganizationUpgrade = () => {
    this.props.fetchMyOrganizations().then(
      () => {
        this.setState(prevState => {
          if (prevState.selectedOrganization) {
            const selectedOrganization = this.getOrganization(prevState.selectedOrganization.key);
            return {
              selectedOrganization
            };
          }
          return null;
        });
      },
      () => {}
    );
  };

  handleProjectNameChange = (projectName?: string) => {
    this.setState({ projectName });
  };

  handleProjectKeyChange = (projectKey?: string) => {
    this.setState({ projectKey });
  };

  handleVisibilityChange = (selectedVisibility: T.Visibility) => {
    this.setState({ selectedVisibility });
  };

  render() {
    const { selectedOrganization, submitting } = this.state;
    const canChoosePrivate = this.canChoosePrivate(selectedOrganization);

    return (
      <div className="create-project">
        <div className="flex-1 huge-spacer-right">
          <form className="manual-project-create" onSubmit={this.handleFormSubmit}>
            <OrganizationInput
              onChange={this.handleOrganizationSelect}
              organization={selectedOrganization ? selectedOrganization.key : ''}
              organizations={this.props.userOrganizations}
            />
            <ProjectKeyInput
              className="form-field"
              initialValue={this.state.projectKey}
              onChange={this.handleProjectKeyChange}
            />
            <ProjectNameInput
              className="form-field"
              initialValue={this.state.projectName}
              onChange={this.handleProjectNameChange}
            />
            {isSonarCloud() &&
              selectedOrganization && (
                <div
                  className={classNames('visibility-select-wrapper', {
                    open: Boolean(this.state.selectedOrganization)
                  })}>
                  <VisibilitySelector
                    canTurnToPrivate={canChoosePrivate}
                    onChange={this.handleVisibilityChange}
                    showDetails={true}
                    visibility={canChoosePrivate ? this.state.selectedVisibility : 'public'}
                  />
                </div>
              )}
            <SubmitButton disabled={!this.canSubmit(this.state) || submitting}>
              {translate('setup')}
            </SubmitButton>
            <DeferredSpinner className="spacer-left" loading={submitting} />
          </form>
        </div>

        {isSonarCloud() &&
          selectedOrganization && (
            <div className="create-project-side-sticky">
              <UpgradeOrganizationBox
                className={classNames('animated', { open: !canChoosePrivate })}
                onOrganizationUpgrade={this.handleOrganizationUpgrade}
                organization={selectedOrganization}
              />
            </div>
          )}
      </div>
    );
  }
}
