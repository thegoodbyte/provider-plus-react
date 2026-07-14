import React, { useEffect, useState } from 'react';
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
    const [nextClientId, setNextClientId] = useState<number | null>(null);

    useEffect(() => {
        let active = true;

        if (!visible) {
            setNextClientId(null);
            return () => {
                active = false;
            };
        }

        clientsApi.getNextDisplayId()
            .then((response) => {
                if (active) {
                    setNextClientId(response.data || null);
                    form.setFieldsValue({ display_id: response.data || null });
                }
            })
            .catch((error) => {
                console.error('Error loading next client ID:', error);
                if (active) setNextClientId(null);
            });

        return () => {
            active = false;
        };
    }, [visible, form]);

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            // Format the data for quick add
            const clientData = {
                display_id: values.display_id ? Number(values.display_id) : undefined,
                firstName: values.firstName,
                lastName: values.lastName,
                phone: values.phone,
                email: values.email || '',
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
                <Form.Item name="display_id" hidden>
                    <Input />
                </Form.Item>
                <Form.Item label="Client ID">
                    <Input
                        value={nextClientId ? `#${nextClientId}` : 'Loading next client ID...'}
                        readOnly
                        disabled
                    />
                </Form.Item>

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

                <Form.Item
                    name="phone"
                    label="Phone Number"
                    rules={[{ required: true, message: 'Please enter phone number' }]}
                >
                    <Input placeholder="+1 234 567 8900" />
                </Form.Item>

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
                    label="Client Portal PIN"
                >
                    <Input
                        value="Generated automatically on save"
                        readOnly
                        disabled
                    />
                    <div style={{ marginTop: 6, fontSize: 12, color: '#6b7280' }}>
                        A secure 6-digit PIN is assigned by the server when the client is created.
                    </div>
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
