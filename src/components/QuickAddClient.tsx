import React, { useState } from 'react';
import { Modal, Form, Input, Select, Button, message, DatePicker } from 'antd';
import { clientsApi } from '../services/api';
import './QuickAddClient.css';

const { Option } = Select;
const { TextArea } = Input;

interface QuickAddClientProps {
    visible: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const QuickAddClient: React.FC<QuickAddClientProps> = ({ visible, onClose, onSuccess }) => {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            // Format the data for quick add
            const clientData = {
                firstName: values.firstName,
                lastName: values.lastName,
                phoneCountryCode: values.phoneCountryCode || '+1',
                phone: values.phone,
                email: values.email || '',
                loginPin: values.loginPin || undefined,
                country: values.country || 'USA',
                source: values.source || '',
                notes: values.notes || '',
                address: values.address || 'TBD',
                initialContactDate: values.initialContactDate || new Date()
            };

            // Use the quick-add endpoint
            await clientsApi.quickAdd(clientData);

            message.success('Potential client added successfully!');
            form.resetFields();
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error adding client:', error);
            message.error(error.response?.data?.message || 'Failed to add client');
        } finally {
            setLoading(false);
        }
    };

    const sourceOptions = [
        'Website',
        'Referral',
        'Social Media',
        'Google Search',
        'Friend',
        'Previous Client',
        'Other'
    ];

    const countryCodeOptions = [
        { label: 'United States (+1)', value: '+1' },
        { label: 'Canada (+1)', value: '+1' },
        { label: 'United Kingdom (+44)', value: '+44' },
        { label: 'Germany (+49)', value: '+49' },
        { label: 'France (+33)', value: '+33' },
        { label: 'Spain (+34)', value: '+34' },
        { label: 'Italy (+39)', value: '+39' },
        { label: 'Poland (+48)', value: '+48' },
        { label: 'Czech Republic (+420)', value: '+420' },
        { label: 'Netherlands (+31)', value: '+31' },
        { label: 'Belgium (+32)', value: '+32' },
        { label: 'Switzerland (+41)', value: '+41' },
        { label: 'Austria (+43)', value: '+43' }
    ];

    const countryOptions = [
        'USA',
        'Canada',
        'UK',
        'Germany',
        'France',
        'Spain',
        'Italy',
        'Poland',
        'Czech Republic',
        'Netherlands',
        'Belgium',
        'Switzerland',
        'Austria',
        'Other'
    ];

    return (
        <Modal
            title="Quick Add Potential Client"
            open={visible}
            onCancel={onClose}
            footer={null}
            width={600}
            className="quick-add-modal"
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                autoComplete="off"
            >
                <div className="form-row">
                    <Form.Item
                        name="firstName"
                        label="First Name"
                        rules={[{ required: true, message: 'Please enter first name' }]}
                        style={{ flex: 1, marginRight: 8 }}
                    >
                        <Input placeholder="John" />
                    </Form.Item>

                    <Form.Item
                        name="lastName"
                        label="Last Name"
                        rules={[{ required: true, message: 'Please enter last name' }]}
                        style={{ flex: 1 }}
                    >
                        <Input placeholder="Doe" />
                    </Form.Item>
                </div>

                <div className="form-row">
                    <Form.Item
                        name="phoneCountryCode"
                        label="Country Code"
                        initialValue="+1"
                        style={{ flex: 0.3, marginRight: 8 }}
                    >
                        <Select placeholder="Code">
                            {countryCodeOptions.map(option => (
                                <Option key={option.value} value={option.value}>{option.label}</Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        name="phone"
                        label="Phone Number"
                        rules={[{ required: true, message: 'Please enter phone number' }]}
                        style={{ flex: 0.7, marginRight: 8 }}
                    >
                        <Input placeholder="234 567 8900" />
                    </Form.Item>
                </div>

                <Form.Item
                    name="country"
                    label="Country"
                    rules={[{ required: true, message: 'Please select country' }]}
                    initialValue="USA"
                >
                    <Select placeholder="Select country">
                        {countryOptions.map(country => (
                            <Option key={country} value={country}>{country}</Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="email"
                    label="Email (Optional)"
                >
                    <Input type="email" placeholder="john.doe@example.com" />
                </Form.Item>

                <Form.Item
                    name="loginPin"
                    label="Client Portal PIN (Optional)"
                    rules={[
                        {
                            pattern: /^\d{4,6}$/,
                            message: 'PIN must be 4-6 digits'
                        }
                    ]}
                >
                    <Input
                        placeholder="4-6 digit login PIN"
                        maxLength={6}
                        inputMode="numeric"
                        onChange={(event) => {
                            const value = event.target.value.replace(/\D/g, '').slice(0, 6);
                            form.setFieldValue('loginPin', value);
                        }}
                    />
                </Form.Item>

                <Form.Item
                    name="source"
                    label="How did they find you?"
                >
                    <Select placeholder="Select source">
                        {sourceOptions.map(source => (
                            <Option key={source} value={source}>{source}</Option>
                        ))}
                    </Select>
                </Form.Item>

                <Form.Item
                    name="address"
                    label="Address (Optional)"
                >
                    <Input placeholder="City, State/Province" />
                </Form.Item>

                <Form.Item
                    name="notes"
                    label="Initial Notes"
                >
                    <TextArea
                        rows={3}
                        placeholder="Any initial notes about the potential client..."
                    />
                </Form.Item>

                <div className="form-footer">
                    <div className="status-info">
                        Status will be set to: <span className="status-badge potential">POTENTIAL</span>
                    </div>
                    <div className="form-buttons">
                        <Button onClick={onClose}>
                            Cancel
                        </Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            style={{ marginLeft: 8 }}
                        >
                            Add Potential Client
                        </Button>
                    </div>
                </div>
            </Form>
        </Modal>
    );
};

export default QuickAddClient;
